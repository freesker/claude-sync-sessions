package store

import "testing"

func TestSanitizeComponentRejectsTraversal(t *testing.T) {
	bad := []string{"", ".", "..", "a/b", "a\\b", "../x", "a b", "a;b"}
	for _, c := range bad {
		if _, err := SanitizeComponent(c); err == nil {
			t.Fatalf("expected error for %q", c)
		}
	}
	for _, c := range []string{"app", "my-proj_1", "uuid.bundle.gz"} {
		if _, err := SanitizeComponent(c); err != nil {
			t.Fatalf("unexpected error for %q: %v", c, err)
		}
	}
}

func TestSafeJoinContains(t *testing.T) {
	if _, err := SafeJoin("/data/sessions", "alice", "..", "etc"); err == nil {
		t.Fatal("expected traversal rejection")
	}
	p, err := SafeJoin("/data/sessions", "alice", "proj", "s.bundle.gz")
	if err != nil {
		t.Fatal(err)
	}
	if p != "/data/sessions/alice/proj/s.bundle.gz" {
		t.Fatalf("got %q", p)
	}
}
