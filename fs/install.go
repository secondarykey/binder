package fs

import (
	"fmt"
	"io"
	"io/fs"
	"os"

	"golang.org/x/xerrors"
)

// embedからディレクトリを作成
func Create(dir string) (*Binder, error) {

	//TODO ディレクトリは存在ではなく、中身があるかで判定する
	_, err := os.Stat(dir)
	if err == nil {
		return nil, xerrors.Errorf("already directory [%s]", dir)
	}

	err = os.Mkdir(dir, 0666)
	if err != nil {
		return nil, fmt.Errorf("os.Mkdir() error: %w", err)
	}

	//Gitを作成
	b, err := NewBinder(dir)
	if err != nil {
		return nil, xerrors.Errorf("NewBinder() error: %w", err)
	}

	//embedから作成
	matches, err := fs.Glob(assetsFs, "*")
	if err != nil {
		return nil, fmt.Errorf("os.Mkdir() error: %w", err)
	}

	//取得した一覧を登録
	for _, entry := range matches {

		f, err := assetsFs.Open(entry)
		if err != nil {
			return nil, xerrors.Errorf("Open() error: %w", err)
		}

		s, err := f.Stat()
		if err != nil {
			return nil, xerrors.Errorf("Stat() error: %w", err)
		}

		err = add(b, s, "")
		if err != nil {
			return nil, xerrors.Errorf("add() error: %w", err)
		}
	}

	err = b.Commit("Create Binder")
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return b, nil
}

// embed の構造をコピーする
func add(b *Binder, info fs.FileInfo, dir string) error {

	n := info.Name()
	if dir != "" {
		n = dir + "/" + n
	}

	if info.IsDir() {

		entries, err := fs.ReadDir(assetsFs, n)
		if err != nil {
			return xerrors.Errorf("ReadDir() error: %w", err)
		}

		for _, entry := range entries {
			i, err := entry.Info()
			if err != nil {
				return xerrors.Errorf("Info() error: %w", err)
			}

			err = add(b, i, n)
			if err != nil {
				return xerrors.Errorf("add(%s) error: %w", n, err)
			}
		}
	} else {

		data, err := fs.ReadFile(assetsFs, n)
		if err != nil {
			return xerrors.Errorf("ReadFile(%s) error: %w", n, err)
		}

		fp, err := b.Create(n)
		if err != nil {
			return xerrors.Errorf("Create(%s) error: %w", n, err)
		}
		defer fp.Close()

		_, err = fp.(io.Writer).Write(data)
		if err != nil {
			return xerrors.Errorf("Write(%s) error: %w", n, err)
		}
	}
	return nil
}
