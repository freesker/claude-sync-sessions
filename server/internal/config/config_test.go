package config

import "testing"

func TestLoadDefaults(t *testing.T) {
	t.Setenv("DATA_DIR", "/tmp/x")
	t.Setenv("PORT", "")
	t.Setenv("MAX_UPLOAD_BYTES", "")
	c := Load()
	if c.Port != "8000" {
		t.Fatalf("port = %q", c.Port)
	}
	if c.DBPath != "/tmp/x/meta.db" {
		t.Fatalf("dbpath = %q", c.DBPath)
	}
	if c.MaxUploadBytes != 50<<20 {
		t.Fatalf("max = %d", c.MaxUploadBytes)
	}
}
