package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"claude-sync-server/internal/config"
	"claude-sync-server/internal/store"
)

func testServer(t *testing.T) (*httptest.Server, *store.Store) {
	t.Helper()
	dir := t.TempDir()
	s, err := store.Open(dir, filepath.Join(dir, "meta.db"))
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(NewRouter(s, config.Config{MaxUploadBytes: 50 << 20}))
	t.Cleanup(func() { srv.Close(); s.Close() })
	return srv, s
}

func TestSessionContractRoundTrip(t *testing.T) {
	srv, s := testServer(t)
	tok, _ := s.CreateUser("alice", false)
	auth := map[string]string{"Authorization": "Bearer " + tok}

	// push
	req, _ := http.NewRequest("POST", srv.URL+"/api/sessions/push?project=proj&filename=abc123.bundle.gz", bytes.NewReader([]byte("BUNDLE")))
	req.Header.Set("Authorization", auth["Authorization"])
	req.Header.Set("Content-Type", "application/gzip")
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != 200 {
		t.Fatalf("push: %v %d", err, resp.StatusCode)
	}

	// list — must match serverBackend.ts shape
	req, _ = http.NewRequest("GET", srv.URL+"/api/sessions", nil)
	req.Header.Set("Authorization", auth["Authorization"])
	resp, _ = http.DefaultClient.Do(req)
	var listed struct {
		Bundles []struct {
			SessionID, Project, Filename, Label, UpdatedAt string
		} `json:"bundles"`
	}
	json.NewDecoder(resp.Body).Decode(&listed)
	if len(listed.Bundles) != 1 || listed.Bundles[0].SessionID != "abc123" {
		t.Fatalf("list shape: %+v", listed)
	}

	// download by prefix
	req, _ = http.NewRequest("GET", srv.URL+"/api/sessions/abc1", nil)
	req.Header.Set("Authorization", auth["Authorization"])
	resp, _ = http.DefaultClient.Do(req)
	body, _ := io.ReadAll(resp.Body)
	if string(body) != "BUNDLE" {
		t.Fatalf("download: %q", body)
	}
}

func TestSessionsRequireAuth(t *testing.T) {
	srv, _ := testServer(t)
	resp, _ := http.Get(srv.URL + "/api/sessions")
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
	resp, _ = http.Get(srv.URL + "/health")
	if resp.StatusCode != 200 {
		t.Fatalf("health should be open, got %d", resp.StatusCode)
	}
}
