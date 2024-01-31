package fs

import (
	"io"
	"io/fs"
	"log"

	"github.com/go-git/go-billy/v5"
	"golang.org/x/xerrors"
)

// fs.File interface
type File struct {
	name string
	root billy.Filesystem

	billy.File
}

// fs.FS interface
func (b *FileSystem) Open(name string) (fs.File, error) {

	bf, err := b.fs.Open(name)
	if err != nil {
		return nil, xerrors.Errorf("fs.Open() error: %w", err)
	}

	var f File
	f.name = name
	f.root = b.fs
	f.File = bf

	return &f, nil
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
