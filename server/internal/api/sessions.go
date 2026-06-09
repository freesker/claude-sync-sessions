package api

import (
	"fmt"
	"io"
	"net/http"

	"claude-sync-server/internal/auth"
)

type bundleDTO struct {
	SessionID string `json:"sessionId"`
	Project   string `json:"project"`
	Filename  string `json:"filename"`
	Label     string `json:"label"`
	UpdatedAt string `json:"updatedAt"`
}

func (h *Handlers) PushSession(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFrom(r.Context())
	project := r.URL.Query().Get("project")
	filename := r.URL.Query().Get("filename")
	r.Body = http.MaxBytesReader(w, r.Body, h.Cfg.MaxUploadBytes)
	data, err := io.ReadAll(r.Body)
	if err != nil {
		WriteError(w, http.StatusRequestEntityTooLarge, "upload too large")
		return
	}
	if err := h.Store.SaveBundle(u.Username, project, filename, data); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handlers) ListSessions(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFrom(r.Context())
	bundles, err := h.Store.ListBundles(u.Username)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "list failed")
		return
	}
	dto := make([]bundleDTO, 0, len(bundles))
	for _, b := range bundles {
		short := b.SessionID
		if len(short) > 8 {
			short = short[:8]
		}
		dto = append(dto, bundleDTO{
			SessionID: b.SessionID, Project: b.Project, Filename: b.Filename,
			Label: fmt.Sprintf("%s · %s", b.Project, short), UpdatedAt: b.UpdatedAt,
		})
	}
	WriteJSON(w, http.StatusOK, map[string]any{"bundles": dto})
}

func (h *Handlers) DownloadSession(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFrom(r.Context())
	b, err := h.Store.FindBundleByPrefix(u.Username, r.PathValue("prefix"))
	if err != nil || b == nil {
		WriteError(w, http.StatusNotFound, "bundle not found")
		return
	}
	data, err := h.Store.ReadBundle(u.Username, b.Project, b.Filename)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "read failed")
		return
	}
	w.Header().Set("Content-Type", "application/gzip")
	_, _ = w.Write(data)
}

func (h *Handlers) DeleteSession(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFrom(r.Context())
	n, err := h.Store.DeleteBundlesByPrefix(u.Username, r.PathValue("prefix"))
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	WriteJSON(w, http.StatusOK, map[string]int{"deleted": n})
}
