package fs

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/go-git/go-billy/v5"
	"github.com/go-git/go-billy/v5/memfs"
	"github.com/go-git/go-billy/v5/osfs"
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/cache"
	"github.com/go-git/go-git/v5/storage/filesystem"
	"golang.org/x/xerrors"
)

// 現行のBinderと同じ
// Binderはルートに移行しておく
type FileSystem struct {
	fs   billy.Filesystem
	repo *git.Repository

	branch string
	remote string
	base   string
}

func (f *FileSystem) GetPublic() string {
	return publishDir
}

func New(dir string) (*FileSystem, error) {
	fs := osfs.New(dir)
	rtn, err := newFileSystem(fs)
	if err != nil {
		return nil, xerrors.Errorf("newFileSystem() error: %w", err)
	}
	return rtn, nil
}

// メモリ上で扱う方法
// https://gist.github.com/rogerwelin/7b1d2718bfbd94ecdfef0b9854fff99d
func NewMemory() (*FileSystem, error) {
	fs := memfs.New()
	return newFileSystem(fs)
}

func Load(dir string) (*FileSystem, error) {

	r, err := git.PlainOpen(dir)
	if err != nil {
		return nil, xerrors.Errorf("error: %w", err)
	}
	var b FileSystem
	b.repo = r
	fs := osfs.New(dir)
	b.fs = fs
	b.base = dir

	return &b, nil
}

func Clone(dir string, url string) (*FileSystem, error) {

	r, err := git.PlainClone(dir, false, &git.CloneOptions{
		URL:      url,
		Progress: os.Stdout,
	})
	if err != nil {
		return nil, xerrors.Errorf("error: %w", err)
	}

	var b FileSystem
	b.repo = r
	b.remote = url
	fs := osfs.New(dir)
	b.fs = fs
	return &b, nil
}

func newFileSystem(fs billy.Filesystem) (*FileSystem, error) {

	dot, err := fs.Chroot(".git")
	if err != nil {
		return nil, xerrors.Errorf("error: %w", err)
	}
	s := filesystem.NewStorage(dot, cache.NewObjectLRUDefault())

	rep, err := git.Init(s, fs)
	if err != nil {
		return nil, xerrors.Errorf("error: %w", err)
	}

	var b FileSystem
	b.fs = fs
	b.repo = rep

	return &b, nil
}

func (f *FileSystem) Close() error {
	//return f.repo.Close()
	return nil
}

// ディレクトリを親ごと作成
func (b *FileSystem) mkdir(n string) error {
	err := b.fs.MkdirAll(n, 0666)
	if err != nil {
		return xerrors.Errorf("MkdirAll() error: %w", err)
	}
	return nil
}

func (b *FileSystem) isExist(n string) bool {
	_, err := b.fs.Stat(n)
	if err != nil {
		return false
	}
	return true
}

func (b *FileSystem) Create(n string) (*File, error) {
	fp, _, err := b.create(n)
	return fp, err
}

// ファイルを作成し、Addする
func (b *FileSystem) create(n string) (*File, bool, error) {

	index := true
	if b.isExist(n) {
		index = false
	}

	fp, err := b.fs.Create(n)
	if err != nil {
		return nil, index, xerrors.Errorf("Create() error: %w", err)
	}

	if index {
		err = b.Add(n)
		if err != nil {
			return nil, index, xerrors.Errorf("Add() error: %w", err)
		}
	}

	var f File
	f.name = n
	f.root = b.fs
	f.File = fp

	return &f, index, nil
}

func (f *FileSystem) Remove(n string) error {
	if f.base == "" {
		return fmt.Errorf("do not delete filesystem(base is empty):[%s]", n)
	}
	fn := filepath.Join(f.base, n)
	return os.Remove(fn)
}
