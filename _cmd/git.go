package main

import (
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/google/uuid"
	"golang.org/x/xerrors"
)

func main() {
	flag.Parse()
	args := flag.Args()
	err := run(args)
	if err != nil {
		fmt.Fprintf(os.Stderr, "run() error:\n%+v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) < 2 {
		return fmt.Errorf("required arguments: subcommand(status), repository path")
	}
	sub := args[0]
	rep := args[1]

	var err error
	switch sub {
	case "status":
		err = printStatus(rep)
	}

	if err != nil {
		return xerrors.Errorf("subcommand(%s) error: %w", sub, err)
	}

	return nil
}

func write(name string) {
	fp, _ := os.Create("./work/" + name)
	id := uuid.New()
	fp.Write([]byte(id.String()))
	fp.Close()
}

func add(w *git.Worktree, fn string) {
	write(fn)
	w.Add(fn)
}

func Commit(w *git.Worktree, files ...string) {

	for _, f := range files {
		w.Add(f)
	}

	w.Commit("test", &git.CommitOptions{})
}

func printStatus(p string) error {

	r, err := git.PlainOpen(p)
	if err != nil {
		return xerrors.Errorf("git.PlainOpen() error: %w", err)
	}

	w, err := r.Worktree()
	if err != nil {
		return xerrors.Errorf("rep.Worktree() error: %w", err)
	}

	status, err := w.Status()
	if err != nil {
		return xerrors.Errorf("worktree.Status() error: %w", err)
	}

	var files []string
	for key := range status {
		files = append(files, key)
	}

	sort.Slice(files, func(i, j int) bool {
		f1 := files[i]
		f2 := files[j]
		return lessFileName(f1, f2)
	})

	// Statusがある場合pushできない
	fmt.Printf("%-60s| %-10s | %-10s | %s\n", "FileName", "Staging", "Worktree", "Extra")
	for _, f := range files {
		s := status[f]
		fmt.Printf("%-60s| %10c | %10c | %s\n", f, s.Staging, s.Worktree, s.Extra)
	}
	return nil
}

func lessFileName(f1, f2 string) bool {

	sp1 := strings.Split(f1, "/")
	sp2 := strings.Split(f2, "/")
	l1 := len(sp1)
	l2 := len(sp2)
	if l1 != l2 {
		return l1 < l2
	}

	for idx := 0; idx < l1; idx++ {
		if sp1[idx] != sp2[idx] {
			return sp1[idx] < sp2[idx]
		}
	}
	return false
}
