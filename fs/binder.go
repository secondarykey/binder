package fs

import (
	"binder/db"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/cache"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/storage/filesystem"

	"github.com/go-git/go-billy/v5"
	"github.com/go-git/go-billy/v5/memfs"
	"github.com/go-git/go-billy/v5/osfs"

	"golang.org/x/xerrors"
)

//メモリ上で扱う方法
//https://gist.github.com/rogerwelin/7b1d2718bfbd94ecdfef0b9854fff99d

//絶対ファイルを消さない
//今あるファイルをブランチとして取っておく
//もしくはstash

//TODO 認証
//TODO merge
//TODO fetch
//TODO push

//TODO ブランチを作成
//TODO ファイル単体の履歴

type Binder struct {
	fs   billy.Filesystem
	repo *git.Repository

	branch string
	remote string

	localServer        *http.Server
	localServerAddress string
}

func NewBinder(dir string) (*Binder, error) {
	fs := osfs.New(dir)
	return newBinder(fs)
}

func NewMemoryBinder() (*Binder, error) {
	fs := memfs.New()
	return newBinder(fs)
}

func LoadBinder(dir string) (*Binder, error) {

	r, err := git.PlainOpen(dir)
	if err != nil {
		return nil, xerrors.Errorf("error: %w", err)
	}

	var b Binder
	b.repo = r

	//TODO duplicate?
	fs := osfs.New(dir)
	b.fs = fs

	return &b, nil
}

func CloneBinder(dir string, url string) (*Binder, error) {

	//TODO FileSystem
	r, err := git.PlainClone(dir, false, &git.CloneOptions{
		URL:      url,
		Progress: os.Stdout,
	})

	if err != nil {
		return nil, xerrors.Errorf("error: %w", err)
	}

	var b Binder
	b.repo = r
	b.remote = url
	return &b, nil
}

func newBinder(fs billy.Filesystem) (*Binder, error) {

	dot, err := fs.Chroot(".git")
	if err != nil {
		return nil, xerrors.Errorf("error: %w", err)
	}

	//TODO デフォルトブランチ
	s := filesystem.NewStorage(dot, cache.NewObjectLRUDefault())

	rep, err := git.Init(s, fs)
	if err != nil {
		return nil, xerrors.Errorf("error: %w", err)
	}

	var b Binder
	b.fs = fs
	b.repo = rep
	return &b, nil
}

// ファイルをコミットする
func (b *Binder) Commit(m string) error {

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
func (b *Binder) Add(n string) error {

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

// ディレクトリを親ごと作成
func (b *Binder) mkdir(n string) error {
	err := b.fs.MkdirAll(n, 0666)
	if err != nil {
		return xerrors.Errorf("MkdirAll() error: %w", err)
	}
	return nil
}

func (b *Binder) isExist(n string) bool {
	_, err := b.fs.Stat(n)
	if err != nil {
		return false
	}
	return true
}

// ファイルを作成し、Addする
func (b *Binder) Create(n string) (fs.File, error) {

	index := true
	if b.isExist(n) {
		index = false
	}

	fp, err := b.fs.Create(n)
	if err != nil {
		return nil, xerrors.Errorf("Create() error: %w", err)
	}

	if index {
		err = b.Add(n)
		if err != nil {
			return nil, xerrors.Errorf("Add() error: %w", err)
		}
	}

	var f File
	f.name = n
	f.root = b.fs
	f.File = fp

	return &f, nil
}

func (b *Binder) Serve() error {

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return xerrors.Errorf("net.Listen() error: %w", err)
	}

	docs, err := fs.Sub(b, publishDir)
	if err != nil {
		return xerrors.Errorf("docs error: %w", err)
	}

	b.localServerAddress = ln.Addr().String()
	b.localServer = &http.Server{Handler: http.FileServer(http.FS(docs))}

	go func() {
		err := b.localServer.Serve(ln)
		if err != nil {
			log.Printf("local http Server Serve error: %+v", err)
		}
	}()

	return nil
}

func (b *Binder) ServerAddress() string {
	return b.localServerAddress
}

func (b *Binder) Close() error {
	if b.localServer != nil {
		return b.localServer.Close()
	}
	db.Close()
	return nil
}
