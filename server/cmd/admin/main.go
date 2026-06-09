package main

import (
	"flag"
	"fmt"
	"os"

	"claude-sync-server/internal/config"
	"claude-sync-server/internal/store"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: admin <create-user|delete-user|list-users> [args]")
		os.Exit(2)
	}
	cfg := config.Load()
	s, err := store.Open(cfg.DataDir, cfg.DBPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "open store:", err)
		os.Exit(1)
	}
	defer s.Close()

	switch os.Args[1] {
	case "create-user":
		fs := flag.NewFlagSet("create-user", flag.ExitOnError)
		admin := fs.Bool("admin", false, "make the user an admin")
		_ = fs.Parse(os.Args[2:])
		if fs.NArg() != 1 {
			fmt.Fprintln(os.Stderr, "usage: admin create-user [--admin] <username>")
			os.Exit(2)
		}
		token, err := s.CreateUser(fs.Arg(0), *admin)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		fmt.Printf("user %q created. token (store it now, not shown again):\n%s\n", fs.Arg(0), token)
	case "delete-user":
		if len(os.Args) != 3 {
			fmt.Fprintln(os.Stderr, "usage: admin delete-user <username>")
			os.Exit(2)
		}
		if err := s.DeleteUser(os.Args[2]); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		fmt.Println("deleted", os.Args[2])
	case "list-users":
		users, err := s.ListUsers()
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		for _, u := range users {
			fmt.Printf("%s\tadmin=%v\t%s\n", u.Username, u.IsAdmin, u.CreatedAt)
		}
	default:
		fmt.Fprintln(os.Stderr, "unknown command:", os.Args[1])
		os.Exit(2)
	}
}
