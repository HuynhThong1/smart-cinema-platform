package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestUserAdminDelete(t *testing.T) {
	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		if r.Method != http.MethodDelete {
			t.Fatalf("method %s want DELETE", r.Method)
		}
		if r.URL.Path != "/admin/realms/smart-cinema/users/user-1" {
			t.Fatalf("path %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	admin := &UserAdmin{Base: srv.URL + "/admin/realms/smart-cinema", Client: srv.Client()}
	if e := admin.Delete(context.Background(), "user-1"); e != nil {
		t.Fatal(e)
	}
	if !called {
		t.Fatal("identity service was not called")
	}
}
