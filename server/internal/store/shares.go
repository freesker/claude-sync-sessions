package store

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
)

type Share struct {
	ShareID       string
	SessionPrefix string
	Project       string
	SharedBy      string
	SharedWith    string
	Message       string
	CreatedAt     string
}

func shareID() (string, error) {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *Store) CreateShare(sessionPrefix, project, sharedBy, sharedWith, message string) (string, error) {
	id, err := shareID()
	if err != nil {
		return "", err
	}
	_, err = s.db.Exec(
		`INSERT INTO shares(share_id, session_prefix, project, shared_by, shared_with, message, created_at) VALUES(?,?,?,?,?,?,?)`,
		id, sessionPrefix, project, sharedBy, sharedWith, message, nowUTC())
	if err != nil {
		return "", err
	}
	return id, nil
}

func scanShares(rows *sql.Rows) ([]Share, error) {
	defer rows.Close()
	var out []Share
	for rows.Next() {
		var sh Share
		if err := rows.Scan(&sh.ShareID, &sh.SessionPrefix, &sh.Project, &sh.SharedBy, &sh.SharedWith, &sh.Message, &sh.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, sh)
	}
	return out, rows.Err()
}

const shareCols = `share_id, session_prefix, project, shared_by, shared_with, message, created_at`

func (s *Store) Inbox(username string) ([]Share, error) {
	rows, err := s.db.Query(`SELECT `+shareCols+` FROM shares WHERE shared_with=? OR shared_with='*' ORDER BY created_at DESC`, username)
	if err != nil {
		return nil, err
	}
	return scanShares(rows)
}

func (s *Store) Outbox(username string) ([]Share, error) {
	rows, err := s.db.Query(`SELECT `+shareCols+` FROM shares WHERE shared_by=? ORDER BY created_at DESC`, username)
	if err != nil {
		return nil, err
	}
	return scanShares(rows)
}

func (s *Store) GetShare(shareID string) (*Share, error) {
	row := s.db.QueryRow(`SELECT `+shareCols+` FROM shares WHERE share_id=?`, shareID)
	var sh Share
	if err := row.Scan(&sh.ShareID, &sh.SessionPrefix, &sh.Project, &sh.SharedBy, &sh.SharedWith, &sh.Message, &sh.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &sh, nil
}

func (s *Store) DeleteShare(shareID, requester string, isAdmin bool) error {
	sh, err := s.GetShare(shareID)
	if err != nil {
		return err
	}
	if sh == nil {
		return fmt.Errorf("share not found")
	}
	if !isAdmin && sh.SharedBy != requester {
		return fmt.Errorf("not authorized to delete this share")
	}
	_, err = s.db.Exec(`DELETE FROM shares WHERE share_id=?`, shareID)
	return err
}
