package fs

import (
	"binder/api/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/go-git/go-billy/v5"
	"github.com/go-git/go-billy/v5/memfs"
	"github.com/go-git/go-billy/v5/osfs"
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/cache"
	"github.com/go-git/go-git/v5/storage/filesystem"
	"golang.org/x/xerrors"
)

// 現行のBinderと同じ
// Binderはルートに移行しておく
type FileSystem struct {
	fs   billy.Filesystem
	repo *git.Repository

	branch  string
	remote  string
	base    string
	userSig *UserInfo // バインダーごとのユーザ署名（nil の場合はアプリ設定を使用）
}

// TODO 早めに設定しておく必要あり
func (f *FileSystem) GetPublic() string {
	return publishDir
}

func New(dir string) (*FileSystem, error) {
	return NewWithBranch(dir, "")
}

func NewWithBranch(dir string, defaultBranch string) (*FileSystem, error) {
	fs := osfs.New(dir)
	rtn, err := newFileSystem(fs, defaultBranch)
	if err != nil {
		return nil, xerrors.Errorf("newFileSystem() error: %w", err)
	}
	rtn.base = dir
	return rtn, nil
}

// メモリ上で扱う方法
// https://gist.github.com/rogerwelin/7b1d2718bfbd94ecdfef0b9854fff99d
func NewMemory() (*FileSystem, error) {
	fs := memfs.New()
	return newFileSystem(fs, "")
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
	b.base = dir
	return &b, nil
}

func newFileSystem(fs billy.Filesystem, defaultBranch string) (*FileSystem, error) {

	dot, err := fs.Chroot(".git")
	if err != nil {
		return nil, xerrors.Errorf("error: %w", err)
	}
	s := filesystem.NewStorage(dot, cache.NewObjectLRUDefault())

	opts := git.InitOptions{}
	if defaultBranch != "" {
		opts.DefaultBranch = plumbing.ReferenceName(fmt.Sprintf("refs/heads/%s", defaultBranch))
	}

	rep, err := git.InitWithOptions(s, fs, opts)
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
func (f *FileSystem) mkdir(n string) error {
	err := f.fs.MkdirAll(n, 0666)
	if err != nil {
		return xerrors.Errorf("MkdirAll() error: %w", err)
	}
	return nil
}

func (f *FileSystem) isExist(n string) bool {
	_, err := f.fs.Stat(n)
	if err != nil {
		return false
	}
	return true
}

func (f *FileSystem) Create(n string) (*File, error) {
	fp, _, err := f.create(n)
	return fp, err
}

// ファイルを作成し、Addする
func (f *FileSystem) create(n string) (*File, bool, error) {

	index := true
	if f.isExist(n) {
		index = false
	}

	fp, err := f.fs.Create(n)
	if err != nil {
		return nil, index, xerrors.Errorf("Create() error: %w", err)
	}

	if index {
		err = f.add(n)
		if err != nil {
			return nil, index, xerrors.Errorf("Add() error: %w", err)
		}
	}

	var file File
	file.name = n
	file.root = f.fs
	file.File = fp

	return &file, index, nil
}

func (f *FileSystem) DeprecatedRemove(n string) error {

	if !f.isExist(n) {
		return fmt.Errorf("%s not exist", n)
	}

	if f.base == "" {
		return fmt.Errorf("do not delete filesystem(base is empty):[%s]", n)
	}

	fn := filepath.Join(f.base, n)
	err := os.Remove(fn)
	if err != nil {
		return xerrors.Errorf("os.Remove() error: %w", err)
	}

	//TODO インデックスを削除

	return nil
}

func (f *FileSystem) readFile(w io.Writer, n string) error {

	fp, err := f.Open(n)
	if err != nil {
		return xerrors.Errorf("Open() error: %w", err)
	}
	defer fp.Close()

	_, err = io.Copy(w, fp)
	if err != nil {
		return xerrors.Errorf("io.Copy() error: %w", err)
	}

	return nil
}

func (f *FileSystem) writeFile(n string, r io.Reader) error {
	fp, err := f.Create(n)
	if err != nil {
		return xerrors.Errorf("Create() error: %w", err)
	}
	defer fp.Close()

	_, err = io.Copy(fp, r)
	if err != nil {
		return xerrors.Errorf("io.Copy() error: %w", err)
	}
	return nil
}

func (f *FileSystem) copyFile(out string, in string) error {

	fp, err := f.Open(in)
	if err != nil {
		return xerrors.Errorf("Open() error: %w", err)
	}
	defer fp.Close()

	err = f.copyReader(out, fp)
	if err != nil {
		return xerrors.Errorf("copyReader() error: %w", err)
	}

	return nil
}

func (f *FileSystem) copyReader(out string, r io.Reader) error {

	p := filepath.Dir(out)
	f.mkdir(p)

	err := f.writeFile(out, r)
	if err != nil {
		return xerrors.Errorf("writeFile() error: %w", err)
	}

	return nil
}

func (f *FileSystem) getStatus(source, pub string) (json.Status, json.Status, error) {

	us := json.ErrorStatus
	ps := json.ErrorStatus

	p := ConvertPaths(source, pub)

	sfn := p[0]

	m, err := f.modified(sfn)

	if err == nil {
		if len(m) > 0 {
			us = json.UpdatedStatus
		} else {
			us = json.NothingStatus
		}
	} else {
		slog.Warn("modified error " + sfn + ":" + err.Error())
	}

	//公開側に指定がない場合、エラー
	if pub == "" {
		return us, ps, nil
	}

	bi, err := f.Stat(sfn)
	bt := time.Now()
	if err == nil {
		bt = bi.ModTime()
	} else {
		//存在しないはエラー
		return us, ps, fmt.Errorf("source file Nothing[%s]", sfn)
	}

	pi, err := f.Stat(p[1])
	pt := time.Time{}
	if err == nil {
		pt = pi.ModTime()
		if bt.After(pt) {
			ps = json.UpdatedStatus
		} else {
			ps = json.LatestStatus
		}
	} else {
		ps = json.PrivateStatus
	}

	return us, ps, nil
}
