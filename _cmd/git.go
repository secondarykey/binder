package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/format/diff"
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
	case "patch":
		err = printPatch(rep, f)
	default:
		err = fmt.Errorf("NotFound error: %s", sub)
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

func printPatch(p string, f string) error {
	r, err := git.PlainOpen(p)
	if err != nil {
		return xerrors.Errorf("git.PlainOpen() error: %w", err)
	}

	ref, err := r.Head()
	if err != nil {
		return xerrors.Errorf("repo.Head() error: %w", err)
	}

	itr, err := r.Log(&git.LogOptions{
		PathFilter: func(path string) bool {
			return path == f
		},
		From: ref.Hash()})
	if err != nil {
		return xerrors.Errorf("repo.Log() error: %w", err)
	}

	latest, err := itr.Next()
	if err != nil {
		return xerrors.Errorf("commit.Next() error: %w", err)
	}

	//Fromオブジェクトかな？
	fo, err := latest.File(f)
	if err != nil {
		return xerrors.Errorf("commit.File() error: %w", err)
	}

	c, err := fo.Contents()
	if err != nil {
		return xerrors.Errorf("Contents() error: %w", err)
	}

	fmt.Println(latest.Hash)
	//今のデータとdiffを取る
	fmt.Println(fo.Name)
	fmt.Println(c)

	/*
		fp, err := filterPatch(f, patch)
		if err != nil {
			return xerrors.Errorf("filterPatch() error: %w", err)
		}
	*/

	return nil
}

func filterPatch(fn string, p diff.Patch) (diff.Patch, error) {
	for _, fp := range p.FilePatches() {
		if isFile(fn, fp) {
			return newPatch(fp), nil
		}
	}
	return nil, fmt.Errorf("Not Found: %s", fn)
}

func isFile(fn string, p diff.FilePatch) bool {
	from, to := p.Files()
	if from != nil {
		if from.Path() == fn {
			return true
		}
	}
	if to != nil {
		if to.Path() == fn {
			return true
		}
	}
	return false
}

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

	idx := 0
	err = itr.ForEach(func(c *object.Commit) error {

		fmt.Printf("---------------------------------------\n")
		fmt.Printf("Commit: %s\n  Date:%s\n%s\n", c.Hash, c.Author.When, c.Message)
		fmt.Printf("---------------------------------------\n")
		idx++

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
