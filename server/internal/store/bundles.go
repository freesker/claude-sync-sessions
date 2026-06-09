package store

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Bundle struct {
	Username  string
	Project   string
	Filename  string
	SessionID string
	Size      int64
	UpdatedAt string
}

func (s *Store) SaveBundle(username, project, filename string, data []byte) error {
	if !strings.HasSuffix(filename, ".bundle.gz") {
		return fmt.Errorf("filename must end with .bundle.gz")
	}
	dest, err := SafeJoin(s.dataDir, "sessions", username, project, filename)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(dest, data, 0o644); err != nil {
		return err
	}
	sessionID := strings.TrimSuffix(filename, ".bundle.gz")
	_, err = s.db.Exec(`
INSERT INTO bundles(username, project, filename, session_id, size, updated_at)
VALUES(?,?,?,?,?,?)
ON CONFLICT(username, project, filename) DO UPDATE SET size=excluded.size, updated_at=excluded.updated_at`,
		username, project, filename, sessionID, int64(len(data)), nowUTC())
	return err
}

func (s *Store) ListBundles(username string) ([]Bundle, error) {
	rows, err := s.db.Query(
		`SELECT username, project, filename, session_id, size, updated_at FROM bundles WHERE username=? ORDER BY updated_at DESC`,
		username)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Bundle
	for rows.Next() {
		var b Bundle
		if err := rows.Scan(&b.Username, &b.Project, &b.Filename, &b.SessionID, &b.Size, &b.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// hasLikeWildcard reports whether a session-id prefix contains SQL LIKE
// metacharacters. Real session ids are UUIDs (hex + hyphens), so a prefix with
// '%' or '_' is always bogus — we reject it rather than let it match broadly.
func hasLikeWildcard(prefix string) bool {
	return strings.ContainsAny(prefix, "%_")
}

func (s *Store) FindBundleByPrefix(username, prefix string) (*Bundle, error) {
	if hasLikeWildcard(prefix) {
		return nil, nil
	}
	rows, err := s.db.Query(
		`SELECT username, project, filename, session_id, size, updated_at FROM bundles WHERE username=? AND session_id LIKE ? ORDER BY updated_at DESC LIMIT 1`,
		username, prefix+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, nil
	}
	var b Bundle
	if err := rows.Scan(&b.Username, &b.Project, &b.Filename, &b.SessionID, &b.Size, &b.UpdatedAt); err != nil {
		return nil, err
	}
	return &b, nil
}

func (s *Store) ReadBundle(username, project, filename string) ([]byte, error) {
	p, err := SafeJoin(s.dataDir, "sessions", username, project, filename)
	if err != nil {
		return nil, err
	}
	return os.ReadFile(p)
}

func (s *Store) DeleteBundlesByPrefix(username, prefix string) (int, error) {
	if hasLikeWildcard(prefix) {
		return 0, nil
	}
	rows, err := s.db.Query(`SELECT project, filename FROM bundles WHERE username=? AND session_id LIKE ?`, username, prefix+"%")
	if err != nil {
		return 0, err
	}
	type pf struct{ project, filename string }
	var matches []pf
	for rows.Next() {
		var m pf
		if err := rows.Scan(&m.project, &m.filename); err != nil {
			rows.Close()
			return 0, err
		}
		matches = append(matches, m)
	}
	rows.Close()
	count := 0
	for _, m := range matches {
		if p, err := SafeJoin(s.dataDir, "sessions", username, m.project, m.filename); err == nil {
			_ = os.Remove(p)
		}
		if _, err := s.db.Exec(`DELETE FROM bundles WHERE username=? AND project=? AND filename=?`, username, m.project, m.filename); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

func (s *Store) Stats() (users int, bundles int, totalBytes int64, err error) {
	if err = s.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&users); err != nil {
		return
	}
	if err = s.db.QueryRow(`SELECT COUNT(*), COALESCE(SUM(size),0) FROM bundles`).Scan(&bundles, &totalBytes); err != nil {
		return
	}
	return
}
