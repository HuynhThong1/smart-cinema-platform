package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/xuri/excelize/v2"
	"go.mongodb.org/mongo-driver/v2/bson"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"smartcinema/internal/auth"
	"smartcinema/internal/domain"
	"smartcinema/internal/repository"
	"strings"
	"testing"
	"time"
)

type testVerifier struct{}

func (testVerifier) Verify(_ context.Context, token string) (auth.Principal, error) {
	switch token {
	case "manager":
		return auth.Principal{Subject: "m", Name: "manager", Role: "CINEMA_MANAGER", CinemaID: "cinema-gnd"}, nil
	case "office":
		return auth.Principal{Subject: "o", Name: "office", Role: "HEAD_OFFICE"}, nil
	case "admin":
		return auth.Principal{Subject: "admin-id", Name: "admin", Role: "SYSTEM_ADMIN"}, nil
	}
	return auth.Principal{}, errors.New("invalid")
}

type fixture struct {
	s    *Server
	http http.Handler
	ctx  context.Context
}

func setup(t *testing.T) fixture {
	t.Helper()
	uri := os.Getenv("TEST_MONGODB_URI")
	if uri == "" {
		t.Skip("Set TEST_MONGODB_URI to a local Mongo replica set")
	}
	ctx := context.Background()
	store, e := repository.Connect(ctx, uri, "smart_cinema_test_"+strings.ReplaceAll(domain.ID(), "-", "_"))
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { _ = store.DB.Drop(ctx); _ = store.DB.Client().Disconnect(ctx) })
	s := &Server{Store: store, PublicURL: "http://localhost:4201", IPHashSecret: "integration-only-32-character-secret", EmailEnabled: true}
	if e = s.Seed(ctx, true); e != nil {
		t.Fatal(e)
	}
	return fixture{s, s.Router(testVerifier{}, nil), ctx}
}
func (f fixture) request(t *testing.T, method, path, token string, body any) (int, map[string]any) {
	t.Helper()
	var b bytes.Buffer
	if body != nil {
		if e := json.NewEncoder(&b).Encode(body); e != nil {
			t.Fatal(e)
		}
	}
	req := httptest.NewRequest(method, path, &b)
	req.RemoteAddr = "192.0.2.123:1234"
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	f.http.ServeHTTP(w, req)
	out := map[string]any{}
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}
func mustStatus(t *testing.T, want, got int, out any) {
	t.Helper()
	if want != got {
		t.Fatalf("status %d want %d: %#v", got, want, out)
	}
}
func TestAuthorizationAndScope(t *testing.T) {
	f := setup(t)
	for _, tc := range []struct {
		path, token string
		want        int
	}{{"/api/v1/admin/staff", "", 401}, {"/api/v1/admin/staff", "bad", 401}, {"/api/v1/admin/staff?cinemaId=cinema-gbt", "manager", 403}, {"/api/v1/admin/feedback-config", "manager", 403}, {"/api/v1/admin/dashboard/ranking?kind=cinema", "manager", 403}, {"/api/v1/admin/staff/cinema-gbt-staff-1/qr", "manager", 403}, {"/api/v1/admin/staff", "manager", 200}, {"/api/v1/admin/staff?cinemaId=cinema-gbt", "office", 200}} {
		status, out := f.request(t, "GET", tc.path, tc.token, nil)
		mustStatus(t, tc.want, status, out)
	}
	status, out := f.request(t, "GET", "/api/v1/admin/staff", "manager", nil)
	mustStatus(t, 200, status, out)
	for _, v := range out["items"].([]any) {
		if v.(map[string]any)["cinemaId"] != "cinema-gnd" {
			t.Fatal("cross-cinema leak")
		}
	}
	status, out = f.request(t, "PUT", "/api/v1/admin/staff/cinema-gbt-staff-1", "manager", map[string]any{"staffCode": "GBT001", "name": "Updated Staff", "cinemaId": "cinema-gnd", "status": "ACTIVE"})
	mustStatus(t, 403, status, out)
}
func TestFeedbackQRAndSuspiciousLifecycle(t *testing.T) {
	f := setup(t)
	status, out := f.request(t, "GET", "/api/v1/admin/staff/cinema-gnd-staff-1/qr", "manager", nil)
	mustStatus(t, 200, status, out)
	token := out["publicToken"].(string)
	status, out = f.request(t, "GET", "/api/v1/public/feedback/"+token, "", nil)
	mustStatus(t, 200, status, out)
	encoded, _ := json.Marshal(out)
	for _, bad := range []string{"staff", "cinema", "publicToken", "GND"} {
		if strings.Contains(string(encoded), bad) {
			t.Fatalf("public response exposes %s", bad)
		}
	}
	body := map[string]any{"qrToken": token, "rating": 5, "reasons": []string{"FRIENDLY"}, "name": "Khách kiểm thử", "phone": "0912345678", "consent": true, "consentVersion": "v1"}
	for i := 0; i < 2; i++ {
		status, out = f.request(t, "POST", "/api/v1/public/feedback", "", body)
		mustStatus(t, 201, status, out)
		if len(out) != 1 {
			t.Fatal("public submit must return only createdAt")
		}
	}
	var records []domain.Feedback
	if e := f.s.Store.List(f.ctx, "feedbacks", bson.M{"customer.phone": "84912345678"}, bson.D{{Key: "createdAt", Value: 1}}, 0, 0, &records); e != nil {
		t.Fatal(e)
	}
	if len(records) != 2 || records[0].Metadata.Suspicious || !records[1].Metadata.Suspicious {
		t.Fatal("repeat must persist and flag second record")
	}
	if records[0].Consent.AcceptedAt.IsZero() || records[0].Metadata.IPHash == "192.0.2.123" {
		t.Fatal("privacy metadata incorrect")
	}
	status, out = f.request(t, "GET", "/api/v1/admin/feedbacks?search=84912345678", "manager", nil)
	mustStatus(t, 200, status, out)
	if out["total"].(float64) != 1 {
		t.Fatal("suspicious not excluded by default")
	}
	body["rating"] = 1
	body["reasons"] = []string{"FRIENDLY"}
	status, out = f.request(t, "POST", "/api/v1/public/feedback", "", body)
	mustStatus(t, 422, status, out)
	status, out = f.request(t, "POST", "/api/v1/admin/staff/cinema-gnd-staff-1/qr/regenerate", "manager", map[string]any{})
	mustStatus(t, 200, status, out)
	newToken := out["publicToken"].(string)
	if newToken == token {
		t.Fatal("regenerate did not rotate token")
	}
	status, out = f.request(t, "GET", "/api/v1/public/feedback/"+token, "", nil)
	mustStatus(t, 404, status, out)
	status, out = f.request(t, "DELETE", "/api/v1/admin/staff/cinema-gnd-staff-1/qr", "manager", nil)
	mustStatus(t, 200, status, out)
	status, out = f.request(t, "GET", "/api/v1/public/feedback/"+newToken, "", nil)
	mustStatus(t, 404, status, out)
	n, e := f.s.Store.Count(f.ctx, "audit_logs", bson.M{"action": "REGENERATE_QR"})
	if e != nil || n != 1 {
		t.Fatal("missing QR audit")
	}
}
func (f fixture) upload(t *testing.T, name string, data []byte, confirm bool) (int, map[string]any) {
	t.Helper()
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	p, e := w.CreateFormFile("file", name)
	if e != nil {
		t.Fatal(e)
	}
	_, _ = p.Write(data)
	_ = w.WriteField("confirm", fmt.Sprint(confirm))
	_ = w.Close()
	req := httptest.NewRequest("POST", "/api/v1/admin/staff/import", &b)
	req.Header.Set("Authorization", "Bearer manager")
	req.Header.Set("Content-Type", w.FormDataContentType())
	r := httptest.NewRecorder()
	f.http.ServeHTTP(r, req)
	out := map[string]any{}
	_ = json.Unmarshal(r.Body.Bytes(), &out)
	return r.Code, out
}
func TestImportPreviewConfirmationAndXLSX(t *testing.T) {
	f := setup(t)
	data := []byte("Staff Code,Full Name,Cinema Code\nNEW001,Nhân viên mới,GND\nNEW002,Other cinema,GBT\nGND001,Duplicate,GND\nNEW001,Repeated,GND\n")
	status, out := f.upload(t, "staff.csv", data, false)
	mustStatus(t, 200, status, out)
	if out["valid"].(float64) != 1 || out["invalid"].(float64) != 3 {
		t.Fatal(out)
	}
	n, _ := f.s.Store.Count(f.ctx, "staff", bson.M{"staffCode": "NEW001"})
	if n != 0 {
		t.Fatal("preview wrote data")
	}
	status, out = f.upload(t, "staff.csv", data, true)
	mustStatus(t, 200, status, out)
	if out["imported"].(float64) != 1 {
		t.Fatal(out)
	}
	x := excelize.NewFile()
	defer x.Close()
	_ = x.SetSheetRow("Sheet1", "A1", &[]string{"Staff Code", "Full Name", "Cinema Code"})
	_ = x.SetSheetRow("Sheet1", "A2", &[]string{"XLS001", "Excel Example", "GND"})
	buf, e := x.WriteToBuffer()
	if e != nil {
		t.Fatal(e)
	}
	status, out = f.upload(t, "staff.xlsx", buf.Bytes(), false)
	mustStatus(t, 200, status, out)
	if out["valid"].(float64) != 1 {
		t.Fatal(out)
	}
}
func TestRankingThresholdAndRateLimits(t *testing.T) {
	f := setup(t)
	status, out := f.request(t, "GET", "/api/v1/admin/dashboard/ranking", "manager", nil)
	mustStatus(t, 200, status, out)
	for _, v := range out["top"].([]any) {
		if v.(map[string]any)["count"].(float64) < 20 {
			t.Fatal("ineligible staff ranked")
		}
	}
	if len(out["ineligible"].([]any)) == 0 {
		t.Fatal("ineligible missing")
	}
	key := domain.ID()
	for i := 0; i < 5; i++ {
		ok, e := f.s.Store.Allow(f.ctx, key, 3)
		if e != nil || ok != (i < 3) {
			t.Fatalf("limiter %d %v %v", i, ok, e)
		}
	}
}
func TestCoachingAndAudit(t *testing.T) {
	f := setup(t)
	body := map[string]any{"staffId": "cinema-gnd-staff-1", "topic": "Improve service", "action": "Review feedback before shift", "note": "", "followUpDate": time.Now().Add(24 * time.Hour).Format("2006-01-02"), "status": "COMPLETED"}
	status, out := f.request(t, "POST", "/api/v1/admin/coaching", "manager", body)
	mustStatus(t, 200, status, out)
	if out["status"] != "OPEN" {
		t.Fatal("new coaching not OPEN")
	}
	id := out["id"].(string)
	body["status"] = "COMPLETED"
	status, out = f.request(t, "PUT", "/api/v1/admin/coaching/"+id, "manager", body)
	mustStatus(t, 200, status, out)
	if out["completedAt"] == nil {
		t.Fatal("completion timestamp missing")
	}
	body["status"] = "OPEN"
	status, out = f.request(t, "PUT", "/api/v1/admin/coaching/"+id, "manager", body)
	mustStatus(t, 422, status, out)
}

func TestQRDownloadsAndBatchPreservesExisting(t *testing.T) {
	f := setup(t)
	status, out := f.request(t, "GET", "/api/v1/admin/staff/cinema-gnd-staff-1/qr", "manager", nil)
	mustStatus(t, 200, status, out)
	token := out["publicToken"]
	status, out = f.request(t, "POST", "/api/v1/admin/staff/qr/batch", "manager", map[string]any{})
	mustStatus(t, 200, status, out)
	if out["created"].(float64) != 0 {
		t.Fatal("batch recreated existing QRs")
	}
	status, out = f.request(t, "GET", "/api/v1/admin/staff/cinema-gnd-staff-1/qr", "manager", nil)
	mustStatus(t, 200, status, out)
	if out["publicToken"] != token {
		t.Fatal("batch changed token")
	}
	for _, tc := range []struct{ query, suffix string }{
		{"format=png", "_png.png"},
		{"format=svg", "_svg.svg"},
		{"format=pdf", "_a6.pdf"},
		{"format=pdf&size=a5", "_a5.pdf"},
		{"format=pdf&size=sticker", "_sticker.pdf"},
	} {
		req := httptest.NewRequest("GET", "/api/v1/admin/staff/cinema-gnd-staff-1/qr/download?"+tc.query, nil)
		req.Header.Set("Authorization", "Bearer manager")
		w := httptest.NewRecorder()
		f.http.ServeHTTP(w, req)
		if w.Code != 200 || w.Body.Len() < 100 {
			t.Fatalf("%s download failed %d %s", tc.query, w.Code, w.Body.String())
		}
		if strings.HasSuffix(tc.suffix, ".pdf") && !strings.HasPrefix(w.Body.String(), "%PDF-") {
			t.Fatalf("%s is not a PDF", tc.query)
		}
		if disposition := w.Header().Get("Content-Disposition"); !strings.HasSuffix(disposition, tc.suffix+`"`) {
			t.Fatalf("%s named the file %q", tc.query, disposition)
		}
	}
	req := httptest.NewRequest("GET", "/api/v1/admin/staff/cinema-gnd-staff-1/qr/download?format=pdf&size=a3", nil)
	req.Header.Set("Authorization", "Bearer manager")
	w := httptest.NewRecorder()
	f.http.ServeHTTP(w, req)
	if w.Code != 400 {
		t.Fatalf("unknown print size returned %d", w.Code)
	}
}

func TestConcurrentSubmissionsAreRecordedAndFlagged(t *testing.T) {
	f := setup(t)
	_, qr := f.request(t, "GET", "/api/v1/admin/staff/cinema-gnd-staff-1/qr", "manager", nil)
	body := map[string]any{"qrToken": qr["publicToken"], "rating": 5, "reasons": []string{}, "name": "Concurrent Customer", "phone": "0987654321", "consent": true, "consentVersion": "v1"}
	results := make(chan int, 4)
	for i := 0; i < 4; i++ {
		go func() { status, _ := f.request(t, "POST", "/api/v1/public/feedback", "", body); results <- status }()
	}
	for i := 0; i < 4; i++ {
		if status := <-results; status != 201 {
			t.Fatalf("concurrent submission returned %d", status)
		}
	}
	count, e := f.s.Store.Count(f.ctx, "feedbacks", bson.M{"customer.phone": "84987654321"})
	if e != nil || count != 4 {
		t.Fatal("concurrent submissions lost")
	}
	flagged, e := f.s.Store.Count(f.ctx, "feedbacks", bson.M{"customer.phone": "84987654321", "metadata.suspicious": true})
	if e != nil || flagged != 3 {
		t.Fatalf("expected 3 flagged, got %d (%v)", flagged, e)
	}
}

func TestAnalyticsUsesBilingualFeedbackSnapshots(t *testing.T) {
	f := setup(t)
	// Configuration edits must not change labels on historical feedback.
	_, err := f.s.Store.(*repository.Mongo).DB.Collection("feedback_reasons").UpdateMany(f.ctx, bson.M{}, bson.M{"$set": bson.M{"english": "Current configuration only"}})
	if err != nil {
		t.Fatal(err)
	}
	status, out := f.request(t, "GET", "/api/v1/admin/dashboard", "manager", nil)
	mustStatus(t, 200, status, out)
	reasons, ok := out["reasons"].([]any)
	if !ok || len(reasons) == 0 {
		t.Fatal("expected seeded reason analytics")
	}
	for _, item := range reasons {
		reason := item.(map[string]any)
		if reason["english"] == nil || reason["english"] == "" || reason["english"] == "Current configuration only" {
			t.Fatalf("expected stored English snapshot: %#v", reason)
		}
	}
	// Legacy feedback without an English field remains queryable with its Vietnamese label.
	_, err = f.s.Store.(*repository.Mongo).DB.Collection("feedbacks").UpdateMany(f.ctx, bson.M{}, bson.M{"$unset": bson.M{"reasons.$[].english": ""}})
	if err != nil {
		t.Fatal(err)
	}
	status, out = f.request(t, "GET", "/api/v1/admin/dashboard", "manager", nil)
	mustStatus(t, 200, status, out)
	for _, item := range out["reasons"].([]any) {
		if item.(map[string]any)["label"] == "" {
			t.Fatal("legacy Vietnamese label was lost")
		}
	}
}
