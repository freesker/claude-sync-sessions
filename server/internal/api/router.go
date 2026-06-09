package api

import (
	"log"
	"net/http"

	"claude-sync-server/internal/auth"
	"claude-sync-server/internal/config"
	"claude-sync-server/internal/store"
)

type Handlers struct {
	Store *store.Store
	Cfg   config.Config
}

func NewRouter(s *store.Store, cfg config.Config) http.Handler {
	h := &Handlers{Store: s, Cfg: cfg}
	mw := &auth.Middleware{Store: s}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", Health)

	// sessions (user-scoped)
	mux.Handle("POST /api/sessions/push", mw.RequireUser(http.HandlerFunc(h.PushSession)))
	mux.Handle("GET /api/sessions", mw.RequireUser(http.HandlerFunc(h.ListSessions)))
	mux.Handle("GET /api/sessions/{prefix}", mw.RequireUser(http.HandlerFunc(h.DownloadSession)))
	mux.Handle("DELETE /api/sessions/{prefix}", mw.RequireUser(http.HandlerFunc(h.DeleteSession)))

	// admin
	mux.Handle("POST /api/admin/users", mw.RequireAdmin(http.HandlerFunc(h.CreateUser)))
	mux.Handle("GET /api/admin/users", mw.RequireAdmin(http.HandlerFunc(h.ListUsers)))
	mux.Handle("DELETE /api/admin/users/{username}", mw.RequireAdmin(http.HandlerFunc(h.DeleteUser)))
	mux.Handle("GET /api/admin/stats", mw.RequireAdmin(http.HandlerFunc(h.Stats)))

	// sharing
	mux.Handle("POST /api/sharing/share", mw.RequireUser(http.HandlerFunc(h.CreateShare)))
	mux.Handle("GET /api/sharing/inbox", mw.RequireUser(http.HandlerFunc(h.Inbox)))
	mux.Handle("GET /api/sharing/outbox", mw.RequireUser(http.HandlerFunc(h.Outbox)))
	mux.Handle("DELETE /api/sharing/{shareID}", mw.RequireUser(http.HandlerFunc(h.RevokeShare)))
	mux.Handle("GET /api/sharing/{shareID}/bundle", mw.RequireUser(http.HandlerFunc(h.SharedBundle)))

	return logRequests(mux)
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}
