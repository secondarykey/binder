package fs

import (
	"errors"
	"os"

	"github.com/go-git/go-billy/v5"
	"github.com/go-git/go-billy/v5/osfs"
	"github.com/go-git/go-git/v5"
	"golang.org/x/xerrors"
)

// 読み取り専用で開く（別の Binder が開いているバインダーを見るだけ）。設計は _docs/readonly-open.md。
//
// 書き込みを止める場所はファイルシステムの一番下（billy.Filesystem）にする。
// ワークツリーも .git（go-git のストレージ）もここを通るので、記録・ブランチ・リセット・
// インデックスの書き込みまで、上の層で止め忘れても必ずここで止まる。
// billy を通らずに os で直接書くところ（user.go・merge.go）は checkWritable で止める。

// ErrReadOnly は読み取り専用で開いたバインダーに書こうとしたときのエラー。
var ErrReadOnly = errors.New("binder is opened read-only")

// LoadReadOnly はバインダーを読み取り専用で開く。
//
// Load と違い、インデックスの自動復旧をしない（そもそも書けない）。
// 「開いている」印も見ない・取らない（相手の Binder が持っている前提）。
func LoadReadOnly(dir string) (*FileSystem, error) {

	rfs := &readOnlyFS{Filesystem: osfs.New(dir)}
	dot, err := rfs.Chroot(git.GitDirName)
	if err != nil {
		return nil, xerrors.Errorf("Chroot() error: %w", err)
	}

	r, err := git.Open(newStorage(dot), rfs)
	if err != nil {
		return nil, xerrors.Errorf("git.Open() error: %w", err)
	}

	var b FileSystem
	b.repo = r
	b.fs = rfs
	b.base = dir
	b.readOnly = true
	return &b, nil
}

// ReadOnly は読み取り専用で開いているかを返す。
func (f *FileSystem) ReadOnly() bool {
	return f.readOnly
}

// checkWritable は、billy を通らずに書く処理の先頭で呼ぶ。
func (f *FileSystem) checkWritable() error {
	if f.readOnly {
		return ErrReadOnly
	}
	return nil
}

// readOnlyFS は書き込み系の操作をすべて ErrReadOnly で断る billy.Filesystem。
type readOnlyFS struct {
	billy.Filesystem
}

const writeFlags = os.O_WRONLY | os.O_RDWR | os.O_CREATE | os.O_TRUNC | os.O_APPEND

func readOnlyError(op, name string) error {
	return &os.PathError{Op: op, Path: name, Err: ErrReadOnly}
}

func (r *readOnlyFS) Create(name string) (billy.File, error) {
	return nil, readOnlyError("create", name)
}

func (r *readOnlyFS) OpenFile(name string, flag int, perm os.FileMode) (billy.File, error) {
	if flag&writeFlags != 0 {
		return nil, readOnlyError("open", name)
	}
	return r.Filesystem.OpenFile(name, flag, perm)
}

func (r *readOnlyFS) Rename(oldpath, newpath string) error {
	return readOnlyError("rename", oldpath)
}

func (r *readOnlyFS) Remove(name string) error {
	return readOnlyError("remove", name)
}

func (r *readOnlyFS) TempFile(dir, prefix string) (billy.File, error) {
	return nil, readOnlyError("tempfile", dir)
}

func (r *readOnlyFS) MkdirAll(name string, perm os.FileMode) error {
	return readOnlyError("mkdir", name)
}

func (r *readOnlyFS) Symlink(target, link string) error {
	return readOnlyError("symlink", link)
}

// Chroot した先（.git など）も読み取り専用のままにする。
func (r *readOnlyFS) Chroot(path string) (billy.Filesystem, error) {
	c, err := r.Filesystem.Chroot(path)
	if err != nil {
		return nil, err
	}
	return &readOnlyFS{Filesystem: c}, nil
}
