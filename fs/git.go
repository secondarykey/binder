package fs

import (
	"binder/settings"
	"log"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
	"golang.org/x/xerrors"
)

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
	auth := set.Authentication

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

	ok := false
	sig.When = time.Now()
	for _, f := range files {
		s, ok := status[f]
		if !ok {
			continue
		}
		if s.Worktree == git.Modified {
			w.Add(f)
			ok = true
		}
	}

	if !ok {
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
