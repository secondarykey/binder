package fs

import (
	"fmt"
	"io/fs"
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
}

// Binder File System
// -> 空のディレクトリは作成時に無理なので気を付ける
//   - docs/
//     index.html
//     list_{%num}.html
//   - notes/
//     {note_id}.html
//     {note_id} -> 指定した画像データ
//   - assets/
//     {data_id} (none note_id)
//   - {note_id}/
//     {data_id}
var PublishDir = "docs"

func IndexHTML() string {
	return filepath.Join(PublishDir, "index.html")
}

func ListHTML(idx int) string {
	return filepath.Join(PublishDir, fmt.Sprintf("list_%d.html", idx))
}

func noteHTML(id string) string {
	return filepath.Join(PublishDir, "notes", fmt.Sprintf("%s.html", id))
}

func noteImage(id string) string {
	return filepath.Join(PublishDir, "assets", id, "index")
}

func dataPath(id string, noteId string) string {
	if noteId == "" {
		return filepath.Join(PublishDir, "assets", id)
	}
	return filepath.Join(PublishDir, "assets", noteId, "%s")
}

//   - templates/
//     layout.tmpl (指定できるようにすべきかなぁ、、、)
//     index.tmpl
//     list.tmpl
//     note.tmpl
const templateDir = "templates"

func TemplateFileName(id string) string {
	switch id {
	case "layout":
		return layoutTemplate()
	case "index":
		return indexTemplate()
	case "list":
		return listTemplate()
	case "note":
		return noteTemplate()
	}
	return ""
}

func layoutTemplate() string {
	return templateDir + "/layout.tmpl"
}

func indexTemplate() string {
	return templateDir + "/index.tmpl"
}

func listTemplate() string {
	return templateDir + "/list.tmpl"
}

func noteTemplate() string {
	return templateDir + "/note.tmpl"
}

//   - notes/
//     {note_id}.md
const noteDir = "notes"

func NoteTextFile(id string) string {
	return noteTextFile(id)
}

func noteTextFile(id string) string {
	return filepath.Join(noteDir, fmt.Sprintf("%s.md", id))
}

//   - data/
//     {data_id}.md
//   - {note_id}/
//     {data_id}.md //assets は直接docsに入れる
const dataDir = "data"

func DataTextFile(id string, noteId string) string {
	return dataTextFile(id, noteId)
}

func dataTextFile(id string, noteId string) string {
	if noteId == "" {
		return filepath.Join(dataDir, fmt.Sprintf("%s.md", id))
	}
	return filepath.Join(dataDir, noteId, fmt.Sprintf("%s.md", id))
}

func New(dir string) (*FileSystem, error) {
	fs := osfs.New(dir)
	return newFileSystem(fs)
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

// ファイルを作成し、Addする
func (b *FileSystem) Create(n string) (fs.File, error) {

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
