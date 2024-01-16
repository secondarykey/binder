package fs

import (
	"io/fs"

	"github.com/go-git/go-billy/v5"
	"golang.org/x/xerrors"
)

// fs.File interface
type File struct {
	name string
	root billy.Filesystem

	billy.File
}

// 存在しない場合、ファイルを作成
// fs.FS interface
func (b *Binder) Open(name string) (fs.File, error) {

	bf, err := b.fs.Open(name)
	//bf, err := b.fs.OpenFile(name, os.O_RDWR, 0644)
	if err != nil {
		return nil, xerrors.Errorf("fs.Open() error: %w", err)
	}

	var f File
	f.name = name
	f.root = b.fs
	f.File = bf

	return &f, nil
}

func (f *File) Write(d []byte) (int, error) {

	//TODO 一度閉じてCreateするみたいなことができるか？
	err := f.File.Close()
	if err != nil {
		return 0, xerrors.Errorf("Close() error: %w", err)
	}

	fp, err := f.root.Create(f.name)
	if err != nil {
		return 0, xerrors.Errorf("Create() error: %w", err)
	}
	//ポインタを切り替える
	f.File = fp

	return fp.Write(d)
}

func (f *File) Stat() (fs.FileInfo, error) {
	return f.root.Stat(f.name)
}
