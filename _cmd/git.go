package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
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

	f := ""
	if len(args) >= 3 {
		f = args[2]
	}

	var err error
	switch sub {
	case "status":
		err = printStatus(rep)
	case "log":
		err = printLog(rep, f)
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

var ItrDone = fmt.Errorf("Iterator done.")

func printLog(p string, f string) error {

	r, err := git.PlainOpen(p)
	if err != nil {
		return xerrors.Errorf("git.PlainOpen() error: %w", err)
	}

	/*
		w, err := r.Worktree()
		if err != nil {
			return xerrors.Errorf("rep.Worktree() error: %w", err)
		}

		//ブランチ切り替え
		 w.Checkout(&git.CheckoutOptions{
		     Branch: plumbing.NewBranchReferenceName("name")
		 })
	*/
	ref, err := r.Head()
	if err != nil {
		return xerrors.Errorf("repo.Head() error: %w", err)
	}

	itr, err := r.Log(&git.LogOptions{
		PathFilter: func(path string) bool {
			//指定時はここ
			if f == "" {
				return true
			}
			return path == f
		},
		From: ref.Hash()})
	if err != nil {
		return xerrors.Errorf("repo.Log() error: %w", err)
	}

	commit, err := r.CommitObject(ref.Hash())
	if err != nil {
		return xerrors.Errorf("repo.CommitObject() error: %w", err)
	}
	parent, err := commit.Parents().Next()
	if err != nil {
		return xerrors.Errorf("commit.Parents() error: %w", err)
	}

	idx := 0
	err = itr.ForEach(func(c *object.Commit) error {
		fmt.Printf("---------------------------------------\n")
		fmt.Printf("Commit: %s\n  Date:%s\n%s\n", c.Hash, c.Author.When, c.Message)
		idx++

		patch, err := parent.Patch(c)
		if err != nil {
			return err
		}

		fmt.Println(patch)

		//for _, fp := range patch.FilePatches() {

		/*
			//fp.IsBinary
			from, to := fp.Files()
			//create new file is nil
			if from != nil {
				fmt.Printf("FROM:%s\n", from.Path())
			}
			//delete is nil
			if to != nil {
				fmt.Printf("To  :%s\n", to.Path())
			}

			for _, chunk := range fp.Chunks() {
				fmt.Printf(chunk.Content())
			}
			fmt.Println()

			//if fp.FileName() == f {
			//fmt.Printf("%s\n", fp.String())
			//}
		*/
		//}

		if idx >= 5 {
			return ItrDone
		}
		return nil
	})

	if err != nil {
		if !errors.Is(err, ItrDone) {
			return xerrors.Errorf("itr.ForEach() error: %w", err)
		}
	}
	return nil
}
