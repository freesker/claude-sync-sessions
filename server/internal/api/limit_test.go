package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"claude-sync-server/internal/config"
	"claude-sync-server/internal/store"
)

func TestUploadSizeLimit(t *testing.T) {
	dir := t.TempDir()
	s, _ := store.Open(dir, filepath.Join(dir, "meta.db"))
	defer s.Close()
	srv := httptest.NewServer(NewRouter(s, config.Config{MaxUploadBytes: 8})) // tiny cap
	defer srv.Close()
	tok, _ := s.CreateUser("alice", false)

	req, _ := http.NewRequest("POST", srv.URL+"/api/sessions/push?project=p&filename=x.bundle.gz", bytes.NewReader(make([]byte, 1024)))
	req.Header.Set("Authorization", "Bearer "+tok)
	resp, _ := http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d", resp.StatusCode)
	}
}
