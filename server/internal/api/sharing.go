package api

import (
	"encoding/json"
	"net/http"

	"claude-sync-server/internal/auth"
	"claude-sync-server/internal/store"
)

func (h *Handlers) CreateShare(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFrom(r.Context())
	var body struct {
		SessionPrefix string `json:"sessionPrefix"`
		Project       string `json:"project"`
		SharedWith    string `json:"sharedWith"`
		Message       string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.SessionPrefix == "" || body.Project == "" || body.SharedWith == "" {
		WriteError(w, http.StatusBadRequest, "sessionPrefix, project, sharedWith required")
		return
	}
	// Verify the caller actually owns a matching bundle.
	b, err := h.Store.FindBundleByPrefix(u.Username, body.SessionPrefix)
	if err != nil || b == nil || b.Project != body.Project {
		WriteError(w, http.StatusNotFound, "no matching session to share")
		return
	}
	id, err := h.Store.CreateShare(body.SessionPrefix, body.Project, u.Username, body.SharedWith, body.Message)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "share failed")
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"shareId": id})
}

func (h *Handlers) Inbox(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFrom(r.Context())
	shares, err := h.Store.Inbox(u.Username)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "inbox failed")
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"shares": sharesToDTO(shares)})
}

func (h *Handlers) Outbox(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFrom(r.Context())
	shares, err := h.Store.Outbox(u.Username)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "outbox failed")
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"shares": sharesToDTO(shares)})
}

func (h *Handlers) RevokeShare(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFrom(r.Context())
	if err := h.Store.DeleteShare(r.PathValue("shareID"), u.Username, u.IsAdmin); err != nil {
		WriteError(w, http.StatusForbidden, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handlers) SharedBundle(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFrom(r.Context())
	sh, err := h.Store.GetShare(r.PathValue("shareID"))
	if err != nil || sh == nil {
		WriteError(w, http.StatusNotFound, "share not found")
		return
	}
	if !u.IsAdmin && sh.SharedWith != u.Username && sh.SharedWith != "*" && sh.SharedBy != u.Username {
		WriteError(w, http.StatusForbidden, "not authorized for this share")
		return
	}
	// Resolve the owner's bundle and stream it. Re-check the project so a share
	// scoped to one project can't serve a different same-prefix bundle.
	b, err := h.Store.FindBundleByPrefix(sh.SharedBy, sh.SessionPrefix)
	if err != nil || b == nil || b.Project != sh.Project {
		WriteError(w, http.StatusNotFound, "shared bundle missing")
		return
	}
	data, err := h.Store.ReadBundle(sh.SharedBy, b.Project, b.Filename)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "read failed")
		return
	}
	w.Header().Set("Content-Type", "application/gzip")
	_, _ = w.Write(data)
}

type shareDTO struct {
	ShareID       string `json:"shareId"`
	SessionPrefix string `json:"sessionPrefix"`
	Project       string `json:"project"`
	SharedBy      string `json:"sharedBy"`
	SharedWith    string `json:"sharedWith"`
	Message       string `json:"message"`
	CreatedAt     string `json:"createdAt"`
}

func sharesToDTO(in []store.Share) []shareDTO {
	out := make([]shareDTO, 0, len(in))
	for _, s := range in {
		out = append(out, shareDTO{s.ShareID, s.SessionPrefix, s.Project, s.SharedBy, s.SharedWith, s.Message, s.CreatedAt})
	}
	return out
}
