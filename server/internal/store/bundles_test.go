package store

import (
	"strings"
	"testing"
)

func TestPrefixWildcardsAreRejected(t *testing.T) {
	s := newTestStore(t)
	if err := s.SaveBundle("alice", "proj", "abc123.bundle.gz", []byte("x")); err != nil {
		t.Fatal(err)
	}
	// "%" / "_" must not match broadly via SQL LIKE
	for _, p := range []string{"%", "_", "a%", "ab_"} {
		b, err := s.FindBundleByPrefix("alice", p)
		if err != nil || b != nil {
			t.Fatalf("find %q: expected nil,nil got %v,%v", p, b, err)
		}
	}
	n, err := s.DeleteBundlesByPrefix("alice", "%")
	if err != nil || n != 0 {
		t.Fatalf("delete %%: expected 0,nil got %d,%v", n, err)
	}
	// the real bundle is untouched
	if b, _ := s.FindBundleByPrefix("alice", "abc1"); b == nil {
		t.Fatal("real bundle should still be found by a literal prefix")
	}
}

func TestBundleRoundTripAndPrefix(t *testing.T) {
	s := newTestStore(t)
	data := []byte("gzip-bytes")
	if err := s.SaveBundle("alice", "proj", "abc123.bundle.gz", data); err != nil {
		t.Fatal(err)
	}
	list, err := s.ListBundles("alice")
	if err != nil || len(list) != 1 {
		t.Fatalf("list: %v %v", list, err)
	}
	if list[0].SessionID != "abc123" || list[0].Project != "proj" {
		t.Fatalf("got %+v", list[0])
	}
	b, err := s.FindBundleByPrefix("alice", "abc1")
	if err != nil || b == nil {
		t.Fatalf("find: %v %v", b, err)
	}
	got, err := s.ReadBundle("alice", b.Project, b.Filename)
	if err != nil || string(got) != "gzip-bytes" {
		t.Fatalf("read: %q %v", got, err)
	}
	n, err := s.DeleteBundlesByPrefix("alice", "abc1")
	if err != nil || n != 1 {
		t.Fatalf("delete: %d %v", n, err)
	}
}

func TestSaveBundleRejectsBadNames(t *testing.T) {
	s := newTestStore(t)
	if err := s.SaveBundle("alice", "../etc", "x.bundle.gz", []byte("x")); err == nil {
		t.Fatal("expected project traversal rejection")
	}
	if err := s.SaveBundle("alice", "proj", "../../x.bundle.gz", []byte("x")); err == nil {
		t.Fatal("expected filename traversal rejection")
	}
	if err := s.SaveBundle("alice", "proj", "x.txt", []byte("x")); err == nil {
		t.Fatal("expected .bundle.gz suffix requirement")
	}
}

var _ = strings.TrimSuffix
