package config

import (
	"os"
	"path/filepath"
	"strconv"
)

type Config struct {
	Port           string
	DataDir        string
	DBPath         string
	MaxUploadBytes int64
	AdminToken     string
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func Load() Config {
	dataDir := getenv("DATA_DIR", "/data")
	maxBytes := int64(50 << 20)
	if v := os.Getenv("MAX_UPLOAD_BYTES"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			maxBytes = n
		}
	}
	return Config{
		Port:           getenv("PORT", "8000"),
		DataDir:        dataDir,
		DBPath:         getenv("DB_PATH", filepath.Join(dataDir, "meta.db")),
		MaxUploadBytes: maxBytes,
		AdminToken:     os.Getenv("ADMIN_TOKEN"),
	}
}
