package api

import (
	"encoding/json"
	"net/http"
)

func (h *Handlers) CreateUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		IsAdmin  bool   `json:"isAdmin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Username == "" {
		WriteError(w, http.StatusBadRequest, "username required")
		return
	}
	token, err := h.Store.CreateUser(body.Username, body.IsAdmin)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"username": body.Username, "token": token})
}

func (h *Handlers) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.Store.ListUsers()
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "list failed")
		return
	}
	type dto struct {
		Username  string `json:"username"`
		IsAdmin   bool   `json:"isAdmin"`
		CreatedAt string `json:"createdAt"`
	}
	out := make([]dto, 0, len(users))
	for _, u := range users {
		out = append(out, dto{u.Username, u.IsAdmin, u.CreatedAt})
	}
	WriteJSON(w, http.StatusOK, out)
}

func (h *Handlers) DeleteUser(w http.ResponseWriter, r *http.Request) {
	if err := h.Store.DeleteUser(r.PathValue("username")); err != nil {
		WriteError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handlers) Stats(w http.ResponseWriter, r *http.Request) {
	users, bundles, total, err := h.Store.Stats()
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "stats failed")
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"users": users, "bundles": bundles, "totalBytes": total})
}
