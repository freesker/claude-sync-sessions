package store

import (
	"path/filepath"
	"testing"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	dir := t.TempDir()
	s, err := Open(dir, filepath.Join(dir, "meta.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestOpenMigrateIdempotent(t *testing.T) {
	dir := t.TempDir()
	dbp := filepath.Join(dir, "meta.db")
	s1, err := Open(dir, dbp)
	if err != nil {
		t.Fatal(err)
	}
	s1.Close()
	s2, err := Open(dir, dbp) // re-open: migrate must be idempotent
	if err != nil {
		t.Fatal(err)
	}
	s2.Close()
}
