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

func M(prefix string, name string) string {
	return fmt.Sprintf("%-10s : %s", prefix, name)
}

func (b *FileSystem) CreateRemote(name, url string) error {

	_, err := b.repo.CreateRemote(&config.RemoteConfig{
		Name: name,
		URLs: []string{url},
	})

	if err != nil {
		return xerrors.Errorf("CreateRemote() error: %w", err)
	}

	return nil
}

func (b *FileSystem) GetRemotes() ([]*config.RemoteConfig, error) {
	r, err := b.repo.Remotes()
	if err != nil {
		return nil, xerrors.Errorf("repository.Remotes() error: %w", err)
	}

	rtn := make([]*config.RemoteConfig, len(r))
	for idx, remote := range r {
		rtn[idx] = remote.Config()
	}
	return rtn, nil
}

func (b *FileSystem) Push(r, name string) error {

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

	remote, err := b.repo.Remote(r)
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

	branch := plumbing.ReferenceName(fmt.Sprintf("refs/heads/%s", name))
	refName := head.Name()
	if string(branch) == string(refName) {
		return nil
	}

	ref := plumbing.NewHashReference(branch, head.Hash())
	err = b.repo.Storer.SetReference(ref)
	if err != nil {
		return xerrors.Errorf("repository SetReference() error: %w", err)
	}

	w, err := b.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Worktree() error: %w", err)
	}

	//TODO すでに存在して処理する場合

	err = w.Checkout(&git.CheckoutOptions{Branch: branch})
	if err != nil {
		return xerrors.Errorf("Checkout() error: %w", err)
	}
	return nil
}

// テンプレートファイルをコミットする
func (b *FileSystem) TemplatesCommit() error {
	files := []string{TemplateFile("layout"), TemplateFile("index"),
		TemplateFile("list"), TemplateFile("note")}
	return b.Commit(M("auto save", "Templates"), files...)
}

// ファイルをコミットする
func (b *FileSystem) Commit(m string, files ...string) error {

	set := settings.Get()
	auth := set.Git

	sig := &object.Signature{
		Name: auth.Name, Email: auth.Mail,
	}
	return b.commit(m, sig, false, files...)
}

func (b *FileSystem) AutoCommit(m string, files ...string) error {
	return b.autoCommit(m, false, files...)
}

// 自動コミット
func (b *FileSystem) autoCommit(m string, all bool, files ...string) error {
	sig := &object.Signature{
		Name:  "Binder System",
		Email: "-",
	}
	return b.commit(m, sig, all, files...)
}

func (b *FileSystem) CommitAll(m string) error {
	return b.autoCommit(m, true)
}

func (b *FileSystem) commit(m string, sig *object.Signature, all bool, files ...string) error {

	w, err := b.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Worktree() error: %w", err)
	}

	status, err := w.Status()
	if err != nil {
		return xerrors.Errorf("Status() error: %w", err)
	}

	commitOk := false
	if all {
		commitOk = true
	} else {
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
	}

	if !commitOk {
		// update file nothing
		log.Println("update file nothing")
		return nil
	}

	sig.When = time.Now()
	_, err = w.Commit(m,
		&git.CommitOptions{
			All:    all,
			Author: sig,
		})
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}

// 存在するファイルをadd()する
func (b *FileSystem) Add(files ...string) error {

	w, err := b.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Worktree() error: %w", err)
	}

	for _, n := range files {
		_, err = w.Add(n)
		if err != nil {
			return xerrors.Errorf("Add() error: %w", err)
		}
	}
	return nil
}
