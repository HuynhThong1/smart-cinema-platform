package server

import (
	"net/http"
	"net/http/httptest"
	"smartcinema/internal/auth"
	"testing"
)

func TestCannotDeleteCurrentAdministrator(t *testing.T) {
	s := &Server{Users: &auth.UserAdmin{}}
	r := s.Router(testVerifier{}, nil)
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/users/admin-id", nil)
	req.Header.Set("Authorization", "Bearer admin")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status %d want %d: %s", w.Code, http.StatusUnprocessableEntity, w.Body.String())
	}
}
