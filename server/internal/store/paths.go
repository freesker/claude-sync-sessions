package store

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var componentRe = regexp.MustCompile(`^[A-Za-z0-9._-]+$`)

// SanitizeComponent rejects empty, ".", "..", and anything outside [A-Za-z0-9._-]
// (which also rejects "/" and "\"), preventing path traversal.
func SanitizeComponent(name string) (string, error) {
	if name == "" || name == "." || name == ".." || !componentRe.MatchString(name) {
		return "", fmt.Errorf("invalid path component: %q", name)
	}
	return name, nil
}

// SafeJoin sanitizes each component, joins under root, and verifies the result
// stays inside root.
func SafeJoin(root string, comps ...string) (string, error) {
	parts := []string{root}
	for _, c := range comps {
		s, err := SanitizeComponent(c)
		if err != nil {
			return "", err
		}
		parts = append(parts, s)
	}
	joined := filepath.Join(parts...)
	absJoined, err := filepath.Abs(joined)
	if err != nil {
		return "", err
	}
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	if absJoined != absRoot && !strings.HasPrefix(absJoined, absRoot+string(os.PathSeparator)) {
		return "", fmt.Errorf("path escapes root: %q", joined)
	}
	return joined, nil
}
