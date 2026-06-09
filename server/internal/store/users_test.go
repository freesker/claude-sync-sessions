package store

import "testing"

func TestUserLifecycleAndTokenResolve(t *testing.T) {
	s := newTestStore(t)
	tok, err := s.CreateUser("alice", false)
	if err != nil {
		t.Fatal(err)
	}
	if tok == "" {
		t.Fatal("empty token")
	}
	u, err := s.ResolveToken(tok)
	if err != nil || u == nil {
		t.Fatalf("resolve: %v %v", u, err)
	}
	if u.Username != "alice" || u.IsAdmin {
		t.Fatalf("got %+v", u)
	}
	if bad, _ := s.ResolveToken("nope"); bad != nil {
		t.Fatal("expected nil for bad token")
	}
	if _, err := s.CreateUser("alice", false); err == nil {
		t.Fatal("expected duplicate error")
	}
	n, _ := s.CountUsers()
	if n != 1 {
		t.Fatalf("count = %d", n)
	}
	if err := s.DeleteUser("alice"); err != nil {
		t.Fatal(err)
	}
	if bad, _ := s.ResolveToken(tok); bad != nil {
		t.Fatal("token should be gone")
	}
}

func TestBootstrapCreatesAdminOnce(t *testing.T) {
	s := newTestStore(t)
	if err := s.Bootstrap("admintok"); err != nil {
		t.Fatal(err)
	}
	u, _ := s.ResolveToken("admintok")
	if u == nil || !u.IsAdmin {
		t.Fatalf("admin not created: %+v", u)
	}
	if err := s.Bootstrap("othertok"); err != nil { // users exist now → no-op
		t.Fatal(err)
	}
	if u2, _ := s.ResolveToken("othertok"); u2 != nil {
		t.Fatal("bootstrap should be a no-op when users exist")
	}
}
