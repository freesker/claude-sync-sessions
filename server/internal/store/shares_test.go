package store

import "testing"

func TestShareInboxOutbox(t *testing.T) {
	s := newTestStore(t)
	id, err := s.CreateShare("abc123", "proj", "alice", "bob", "hi")
	if err != nil || len(id) != 8 {
		t.Fatalf("create: %q %v", id, err)
	}
	in, _ := s.Inbox("bob")
	if len(in) != 1 || in[0].SharedBy != "alice" {
		t.Fatalf("inbox: %+v", in)
	}
	out, _ := s.Outbox("alice")
	if len(out) != 1 {
		t.Fatalf("outbox: %+v", out)
	}
	// wildcard share visible to anyone
	if _, err := s.CreateShare("def456", "proj", "alice", "*", ""); err != nil {
		t.Fatal(err)
	}
	in2, _ := s.Inbox("carol")
	if len(in2) != 1 {
		t.Fatalf("wildcard inbox: %+v", in2)
	}
	// non-owner cannot delete
	if err := s.DeleteShare(id, "carol", false); err == nil {
		t.Fatal("expected unauthorized delete error")
	}
	if err := s.DeleteShare(id, "alice", false); err != nil {
		t.Fatal(err)
	}
}
