package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

func bearer(req *http.Request, tok string) *http.Request {
	req.Header.Set("Authorization", "Bearer "+tok)
	return req
}

func TestShareFlow(t *testing.T) {
	srv, s := testServer(t)
	aliceTok, _ := s.CreateUser("alice", false)
	bobTok, _ := s.CreateUser("bob", false)

	// alice pushes a session
	req, _ := http.NewRequest("POST", srv.URL+"/api/sessions/push?project=proj&filename=abc123.bundle.gz", bytes.NewReader([]byte("DATA")))
	http.DefaultClient.Do(bearer(req, aliceTok))

	// alice shares with bob
	shareBody, _ := json.Marshal(map[string]string{"sessionPrefix": "abc123", "project": "proj", "sharedWith": "bob"})
	req, _ = http.NewRequest("POST", srv.URL+"/api/sharing/share", bytes.NewReader(shareBody))
	resp, _ := http.DefaultClient.Do(bearer(req, aliceTok))
	var shareResp struct{ ShareID string `json:"shareId"` }
	json.NewDecoder(resp.Body).Decode(&shareResp)
	if shareResp.ShareID == "" {
		t.Fatal("no shareId")
	}

	// bob sees it in inbox
	req, _ = http.NewRequest("GET", srv.URL+"/api/sharing/inbox", nil)
	resp, _ = http.DefaultClient.Do(bearer(req, bobTok))
	var inbox struct{ Shares []map[string]any `json:"shares"` }
	json.NewDecoder(resp.Body).Decode(&inbox)
	if len(inbox.Shares) != 1 {
		t.Fatalf("inbox: %+v", inbox)
	}

	// bob downloads the shared bundle
	req, _ = http.NewRequest("GET", srv.URL+"/api/sharing/"+shareResp.ShareID+"/bundle", nil)
	resp, _ = http.DefaultClient.Do(bearer(req, bobTok))
	body, _ := io.ReadAll(resp.Body)
	if string(body) != "DATA" {
		t.Fatalf("shared bundle: %q", body)
	}
}
