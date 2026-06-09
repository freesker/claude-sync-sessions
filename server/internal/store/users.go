package store

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"os"
	"time"
)

type User struct {
	Username  string
	IsAdmin   bool
	CreatedAt string
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func GenerateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func nowUTC() string { return time.Now().UTC().Format(time.RFC3339) }

func (s *Store) CreateUser(username string, isAdmin bool) (string, error) {
	if _, err := SanitizeComponent(username); err != nil {
		return "", err
	}
	token, err := GenerateToken()
	if err != nil {
		return "", err
	}
	admin := 0
	if isAdmin {
		admin = 1
	}
	_, err = s.db.Exec(
		`INSERT INTO users(username, token_hash, is_admin, created_at) VALUES(?,?,?,?)`,
		username, HashToken(token), admin, nowUTC(),
	)
	if err != nil {
		return "", fmt.Errorf("create user (maybe exists): %w", err)
	}
	return token, nil
}

func (s *Store) ResolveToken(token string) (*User, error) {
	row := s.db.QueryRow(`SELECT username, is_admin, created_at FROM users WHERE token_hash=?`, HashToken(token))
	var u User
	var admin int
	if err := row.Scan(&u.Username, &admin, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	u.IsAdmin = admin == 1
	return &u, nil
}

func (s *Store) ListUsers() ([]User, error) {
	rows, err := s.db.Query(`SELECT username, is_admin, created_at FROM users ORDER BY username`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []User
	for rows.Next() {
		var u User
		var admin int
		if err := rows.Scan(&u.Username, &admin, &u.CreatedAt); err != nil {
			return nil, err
		}
		u.IsAdmin = admin == 1
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Store) CountUsers() (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Store) DeleteUser(username string) error {
	if _, err := s.db.Exec(`DELETE FROM users WHERE username=?`, username); err != nil {
		return err
	}
	if _, err := s.db.Exec(`DELETE FROM bundles WHERE username=?`, username); err != nil {
		return err
	}
	if dir, err := SafeJoin(s.dataDir, "sessions", username); err == nil {
		_ = os.RemoveAll(dir)
	}
	return nil
}

// Bootstrap creates an "admin" user from adminToken iff no users exist yet.
func (s *Store) Bootstrap(adminToken string) error {
	if adminToken == "" {
		return nil
	}
	n, err := s.CountUsers()
	if err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	_, err = s.db.Exec(
		`INSERT INTO users(username, token_hash, is_admin, created_at) VALUES(?,?,?,?)`,
		"admin", HashToken(adminToken), 1, nowUTC(),
	)
	return err
}
