package fs

import (
	"binder/settings"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"golang.org/x/xerrors"
)

func (b *FileSystem) Push(name string) error {

	set := settings.Get()
	auth := set.Git
	/*
		key, err := ssh.NewPublicKeysFromFile(auth.Name, auth.File, "")
		if err != nil {
			return xerrors.Errorf("repository Head() error: %w", err)
	    }*/
	key := &http.BasicAuth{
		Username: auth.Name,
		Password: auth.Code,
	}

	remote, err := b.repo.Remote("origin")
	if err != nil {
		return xerrors.Errorf("Remote() error: %w", err)
	}

	//remotes/origin/- ではダメらしい
	refSpec := config.RefSpec(
		fmt.Sprintf("+refs/heads/%s:refs/heads/%s", name, name))
	err = remote.Push(&git.PushOptions{
		Progress: os.Stdout,
		RefSpecs: []config.RefSpec{config.RefSpec(refSpec)},
		Auth:     key,
	})

	if err != nil {
		return xerrors.Errorf("remote Push() error: %w", err)
	}

	return nil
}

func (b *FileSystem) Branch(name string) error {

	head, err := b.repo.Head()
	if err != nil {
		return xerrors.Errorf("repository Head() error: %w", err)
	}

	//TODO 存在した場合の処理
	branch := plumbing.ReferenceName(fmt.Sprintf("refs/heads/%s", name))
	ref := plumbing.NewHashReference(branch, head.Hash())
	err = b.repo.Storer.SetReference(ref)
	if err != nil {
		return xerrors.Errorf("repository SetReference() error: %w", err)
	}

	/*
		refName := plumbing.ReferenceName(fmt.Sprintf("refs/heads/%s", name))
		branch := &config.Branch{
			Name:  name,
			Merge: refName,
		}

		err := b.repo.CreateBranch(branch)
		if err != nil {
			return xerrors.Errorf("CreateBranch() error: %w", err)
		}
	*/

	w, err := b.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Checkout() error: %w", err)
	}

	err = w.Checkout(&git.CheckoutOptions{Branch: branch})
	if err != nil {
		return xerrors.Errorf("Checkout() error: %w", err)
	}
	return nil
}

// テンプレートファイルをコミットする
func (b *FileSystem) TemplatesCommit() error {

	files := []string{TemplateFileName("layout"), TemplateFileName("index"),
		TemplateFileName("list"), TemplateFileName("note")}

	m := "auto save  : Templates"
	return b.Commit(m, files...)
}

// ファイルをコミットする
func (b *FileSystem) Commit(m string, files ...string) error {

	set := settings.Get()
	auth := set.Git

	sig := &object.Signature{
		Name: auth.Name, Email: auth.Mail,
	}
	return b.commit(m, sig, files...)
}

// 自動コミット
func (b *FileSystem) AutoCommit(m string, files ...string) error {
	sig := &object.Signature{
		Name:  "Binder System",
		Email: "-",
	}
	return b.commit(m, sig, files...)
}

func (b *FileSystem) commit(m string, sig *object.Signature, files ...string) error {

	w, err := b.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Worktree() error: %w", err)
	}

	status, err := w.Status()
	if err != nil {
		return xerrors.Errorf("Status() error: %w", err)
	}

	commitOk := false
	sig.When = time.Now()
	for _, f := range files {

		s, ok := status[f]
		if !ok {
			continue
		}

		if s.Worktree == git.Modified {
			w.Add(f)
			commitOk = true
		} else if s.Staging == git.Added {
			commitOk = true
		}
	}

	if !commitOk {
		// update file nothing
		log.Println("update file nothing")
		return nil
	}

	_, err = w.Commit(m, &git.CommitOptions{Author: sig})
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}

// 存在するファイルをadd()する
func (b *FileSystem) Add(n string) error {

	w, err := b.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Worktree() error: %w", err)
	}

	_, err = w.Add(n)
	if err != nil {
		return xerrors.Errorf("Add() error: %w", err)
	}
	return nil
}
