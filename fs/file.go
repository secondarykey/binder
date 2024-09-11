package fs

import (
	"io"
	"io/fs"
	"log"

	"github.com/go-git/go-billy/v5"
	"golang.org/x/xerrors"
)

// fs.File implemented
type File struct {
	name string
	root billy.Filesystem

	billy.File
}

// fs.DirEntry implemented
type dirEntry struct {
	fs.FileInfo
}

func (de *dirEntry) Type() fs.FileMode {
	return de.FileInfo.Mode()
}

func (de *dirEntry) Info() (fs.FileInfo, error) {
	return de.FileInfo, nil
}

// fs.FS interface
func (sys *FileSystem) Open(name string) (fs.File, error) {

	bf, err := sys.fs.Open(name)
	if err != nil {
		return nil, xerrors.Errorf("fs.Open() error: %w", err)
	}

	var f File
	f.name = name
	f.root = sys.fs
	f.File = bf

	return &f, nil
}

// fs.ReadDirFS implemented
func (sys *FileSystem) ReadDir(name string) ([]fs.DirEntry, error) {
	infos, err := sys.fs.ReadDir(name)
	if err != nil {
		return nil, err
	}

	dirs := make([]fs.DirEntry, len(infos))
	for idx, info := range infos {
		de := dirEntry{info}
		dirs[idx] = &de
	}
	return dirs, nil
}

func (b *FileSystem) Stat(name string) (fs.FileInfo, error) {
	return b.fs.Stat(name)
}

// io.Writer interface
func (f *File) Write(d []byte) (int, error) {
	return f.File.Write(d)
}

// fs.File interface
func (f *File) Stat() (fs.FileInfo, error) {
	return f.root.Stat(f.name)
}

// text file 1
// binary file 0
// length zero -1
// error -2
func IsText(r io.Reader) int {

	buf := make([]byte, 1024)

	rtn := -1
	for {

		n, err := r.Read(buf)
		if n == 0 {
			break
		}
		rtn = 1

		if err != nil {
			log.Println(err)
			return -2
		}

		//null check
		for idx := 0; idx < n; idx++ {
			v := buf[idx]
			if v == 0 {
				return 0
			}
		}
	}
	return rtn
}
