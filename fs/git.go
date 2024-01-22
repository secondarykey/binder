package fs

import (
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
	"golang.org/x/xerrors"
)

// ファイルをコミットする
func (b *FileSystem) Commit(m string) error {

	w, err := b.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Worktree() error: %w", err)
	}

	_, err = w.Commit(m, &git.CommitOptions{
		Author: &object.Signature{
			Name:  "Binder System",
			Email: "-",
			When:  time.Now(),
		},
	})
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
