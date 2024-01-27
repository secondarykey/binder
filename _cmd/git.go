package main

import (
	"fmt"
	"os"

	"github.com/go-git/go-git/v5"
	"github.com/google/uuid"
)

func main() {

	r, err := git.PlainOpen("./work")
	if err != nil {
		panic(err)
	}

	w, err := r.Worktree()
	if err != nil {
		panic(err)
	}

	write("test1")
	write("test2")

	printStatus(r)

	w, err = r.Worktree()
	Commit(w, "test1")

	printStatus(r)
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

func printStatus(r *git.Repository) {

	w, _ := r.Worktree()
	status, err := w.Status()
	if err != nil {
		return
	}

	// Statusがある場合pushできない
	fmt.Printf("%-30s| %-10s | %-10s | %s\n", "FileName", "Staging", "Worktree", "Extra")
	for key, s := range status {
		fmt.Printf("%-30s| %10c | %10c | %s\n", key, s.Staging, s.Worktree, s.Extra)
	}
}
