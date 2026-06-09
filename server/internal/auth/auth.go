package auth

import (
	"context"
	"net/http"
	"strings"

	"claude-sync-server/internal/store"
)

type ctxKey int

const userKey ctxKey = 0

func WithUser(ctx context.Context, u *store.User) context.Context {
	return context.WithValue(ctx, userKey, u)
}

func UserFrom(ctx context.Context) *store.User {
	u, _ := ctx.Value(userKey).(*store.User)
	return u
}

type Middleware struct{ Store *store.Store }

func bearer(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimSpace(h[len("Bearer "):])
	}
	return ""
}

func (m *Middleware) resolve(w http.ResponseWriter, r *http.Request) (*store.User, bool) {
	tok := bearer(r)
	if tok == "" {
		return nil, false
	}
	u, err := m.Store.ResolveToken(tok)
	if err != nil || u == nil {
		return nil, false
	}
	return u, true
}

func (m *Middleware) RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := m.resolve(w, r)
		if !ok {
			http.Error(w, `{"error":"invalid or missing token"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(WithUser(r.Context(), u)))
	})
}

func (m *Middleware) RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := m.resolve(w, r)
		if !ok {
			http.Error(w, `{"error":"invalid or missing token"}`, http.StatusUnauthorized)
			return
		}
		if !u.IsAdmin {
			http.Error(w, `{"error":"admin access required"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r.WithContext(WithUser(r.Context(), u)))
	})
}
