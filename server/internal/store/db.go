package store

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type Store struct {
	db      *sql.DB
	dataDir string
}

func Open(dataDir, dbPath string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	s := &Store{db: db, dataDir: dataDir}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	_, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS users (
  username   TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  is_admin   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bundles (
  username   TEXT NOT NULL,
  project    TEXT NOT NULL,
  filename   TEXT NOT NULL,
  session_id TEXT NOT NULL,
  size       INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (username, project, filename)
);
CREATE INDEX IF NOT EXISTS idx_bundles_user_session ON bundles(username, session_id);
CREATE TABLE IF NOT EXISTS shares (
  share_id       TEXT PRIMARY KEY,
  session_prefix TEXT NOT NULL,
  project        TEXT NOT NULL,
  shared_by      TEXT NOT NULL,
  shared_with    TEXT NOT NULL,
  message        TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL
);`)
	return err
}
