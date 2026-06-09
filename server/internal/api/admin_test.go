package api

import (
	"net/http"
	"testing"
)

func TestAdminAuthorization(t *testing.T) {
	srv, s := testServer(t)
	userTok, _ := s.CreateUser("bob", false)
	adminTok, _ := s.CreateUser("root", true)

	// non-admin → 403
	req, _ := http.NewRequest("GET", srv.URL+"/api/admin/users", nil)
	req.Header.Set("Authorization", "Bearer "+userTok)
	resp, _ := http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("non-admin expected 403, got %d", resp.StatusCode)
	}

	// admin → 200
	req, _ = http.NewRequest("GET", srv.URL+"/api/admin/users", nil)
	req.Header.Set("Authorization", "Bearer "+adminTok)
	resp, _ = http.DefaultClient.Do(req)
	if resp.StatusCode != 200 {
		t.Fatalf("admin expected 200, got %d", resp.StatusCode)
	}
}
