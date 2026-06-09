package main

import (
	"log"
	"net/http"

	"claude-sync-server/internal/api"
	"claude-sync-server/internal/config"
	"claude-sync-server/internal/store"
)

func main() {
	cfg := config.Load()
	s, err := store.Open(cfg.DataDir, cfg.DBPath)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer s.Close()

	if err := s.Bootstrap(cfg.AdminToken); err != nil {
		log.Fatalf("bootstrap: %v", err)
	}

	handler := api.NewRouter(s, cfg)
	log.Printf("claude-sync-server listening on :%s (data=%s)", cfg.Port, cfg.DataDir)
	if err := http.ListenAndServe(":"+cfg.Port, handler); err != nil {
		log.Fatal(err)
	}
}
