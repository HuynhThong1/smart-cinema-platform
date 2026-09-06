package server

import (
	"context"
	"errors"
	"go.mongodb.org/mongo-driver/v2/bson"
	"net/http"
	"net/http/httptest"
	"smartcinema/internal/auth"
	"smartcinema/internal/domain"
	"smartcinema/internal/repository"
	"strings"
	"testing"
	"time"
)

func TestNotificationRecipientIsolationAndRead(t *testing.T) {
	f := setup(t)
	for _, n := range []domain.Notification{
		{ID: "mine", RecipientID: "m", CinemaID: "cinema-gnd", CreatedAt: time.Now()},
		{ID: "other-manager", RecipientID: "other", CinemaID: "cinema-gnd", CreatedAt: time.Now()},
		{ID: "other-cinema", RecipientID: "m", CinemaID: "cinema-gbt", CreatedAt: time.Now()},
	} {
		if e := f.s.Store.Insert(f.ctx, "notifications", n); e != nil {
			t.Fatal(e)
		}
	}
	for _, tc := range []struct {
		path, who string
		want      int
	}{
		{"/api/v1/admin/notifications", "", 401},
		{"/api/v1/admin/notifications/other-manager/read", "manager", 404},
		{"/api/v1/admin/notifications/other-cinema/read", "manager", 404},
		{"/api/v1/admin/notifications/mine/read", "office", 404},
	} {
		method := "PUT"
		if tc.who == "" {
			method = "GET"
		}
		code, out := f.request(t, method, tc.path, tc.who, nil)
		mustStatus(t, tc.want, code, out)
	}
	code, out := f.request(t, "GET", "/api/v1/admin/notifications", "manager", nil)
	mustStatus(t, 200, code, out)
	if out["total"] != float64(1) {
		t.Fatal(out)
	}
	for range 2 {
		code, out = f.request(t, "PUT", "/api/v1/admin/notifications/mine/read", "manager", nil)
		mustStatus(t, 204, code, out)
	}
	code, out = f.request(t, "GET", "/api/v1/admin/notifications/unread-count", "manager", nil)
	mustStatus(t, 200, code, out)
	if out["count"] != float64(0) {
		t.Fatal(out)
	}
}
func TestQueueNotificationAtomicityAndLease(t *testing.T) {
	f := setup(t)
	db := f.s.Store.(*repository.Mongo)
	st := domain.Staff{ManagerID: "m"}
	feedback := domain.Feedback{ID: "f", CreatedAt: time.Now(), Cinema: domain.Snapshot{ID: "cinema-gnd"}}
	rollback := errors.New("rollback")
	e := db.Transaction(f.ctx, func(ctx context.Context) error {
		if err := f.s.queueFeedbackNotification(ctx, st, feedback); err != nil {
			return err
		}
		return rollback
	})
	if !errors.Is(e, rollback) {
		t.Fatal(e)
	}
	for _, collection := range []string{"notifications", "notification_emails"} {
		n, e := db.Count(f.ctx, collection, bson.M{})
		if e != nil || n != 0 {
			t.Fatalf("%s not rolled back", collection)
		}
	}
	if e := db.Transaction(f.ctx, func(ctx context.Context) error { return f.s.queueFeedbackNotification(ctx, st, feedback) }); e != nil {
		t.Fatal(e)
	}
	first, e := db.ClaimEmail(f.ctx)
	if e != nil {
		t.Fatal(e)
	}
	if _, e := db.ClaimEmail(f.ctx); e == nil {
		t.Fatal("job leased twice")
	}
	if e := db.FinishEmail(f.ctx, first, "pending", "retry", time.Now().Add(-time.Second)); e != nil {
		t.Fatal(e)
	}
	second, e := db.ClaimEmail(f.ctx)
	if e != nil {
		t.Fatal(e)
	}
	if second.Lease == first.Lease || second.Attempts != 2 {
		t.Fatal("lease not refreshed")
	}
	if e := db.FinishEmail(f.ctx, first, "sent", "", time.Now()); e != nil {
		t.Fatal(e)
	}
	var persisted domain.EmailJob
	if e := db.Get(f.ctx, "notification_emails", bson.M{"_id": "f"}, &persisted); e != nil {
		t.Fatal(e)
	}
	if persisted.Status != "sending" {
		t.Fatal("stale lease completed new job")
	}
}

// stubKeycloak answers the handful of admin-API calls the manager flows make.
// notFound lists user ids the identity service no longer knows about.
func stubKeycloak(t *testing.T, notFound ...string) *auth.UserAdmin {
	t.Helper()
	gone := map[string]bool{}
	for _, id := range notFound {
		gone[id] = true
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/admin/realms/test")
		id := strings.TrimPrefix(path, "/users/")
		if i := strings.Index(id, "/"); i >= 0 {
			id = id[:i]
		}
		switch {
		case strings.HasPrefix(path, "/users/") && gone[id]:
			w.WriteHeader(http.StatusNotFound)
		case path == "/roles/CINEMA_MANAGER":
			_, _ = w.Write([]byte(`{"id":"role-1","name":"CINEMA_MANAGER"}`))
		case strings.HasSuffix(path, "/role-mappings/realm") && r.Method == http.MethodGet:
			_, _ = w.Write([]byte(`[{"id":"role-1","name":"CINEMA_MANAGER"}]`))
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	t.Cleanup(srv.Close)
	return &auth.UserAdmin{Base: srv.URL + "/admin/realms/test", Client: srv.Client()}
}

func TestStaffSaveRejectsDeletedManager(t *testing.T) {
	f := setup(t)
	f.s.Users = stubKeycloak(t, "deleted-manager")
	code, out := f.request(t, "POST", "/api/v1/admin/staff", "office", domain.Staff{StaffCode: "NV-404", Name: "Nguyen Van A", CinemaID: "cinema-gnd", Status: "ACTIVE", ManagerID: "deleted-manager"})
	mustStatus(t, 422, code, out)
}

func TestManagerChangesDetachStaleStaffLinks(t *testing.T) {
	f := setup(t)
	f.s.Users = stubKeycloak(t)
	for _, st := range []domain.Staff{
		{ID: "s-gnd", StaffCode: "NV-GND", Name: "Nguyen Van B", CinemaID: "cinema-gnd", Status: "ACTIVE", ManagerID: "m1"},
		{ID: "s-gbt", StaffCode: "NV-GBT", Name: "Nguyen Van C", CinemaID: "cinema-gbt", Status: "ACTIVE", ManagerID: "m1"},
	} {
		if e := f.s.Store.Insert(f.ctx, "staff", st); e != nil {
			t.Fatal(e)
		}
	}
	managerID := func(id string) string {
		var st domain.Staff
		if e := f.s.Store.Get(f.ctx, "staff", bson.M{"_id": id}, &st); e != nil {
			t.Fatal(e)
		}
		return st.ManagerID
	}
	// Moving the manager to Bình Tân must release only the Nguyễn Du staff, whose
	// notifications that account could no longer read.
	code, out := f.request(t, "PUT", "/api/v1/admin/users/m1", "admin", auth.User{Username: "manager1", FirstName: "Quan", LastName: "Ly", Email: "m1@example.com", Enabled: true, Role: "CINEMA_MANAGER", CinemaID: "cinema-gbt"})
	mustStatus(t, 200, code, out)
	if managerID("s-gnd") != "" || managerID("s-gbt") != "m1" {
		t.Fatalf("reassignment detached the wrong staff: gnd=%q gbt=%q", managerID("s-gnd"), managerID("s-gbt"))
	}
	code, out = f.request(t, "DELETE", "/api/v1/admin/users/m1", "admin", nil)
	mustStatus(t, 204, code, out)
	if managerID("s-gbt") != "" {
		t.Fatalf("deleted account still linked: %q", managerID("s-gbt"))
	}
}
