package fs

import (
	"binder/db/model"
	"path/filepath"

	"golang.org/x/xerrors"
)

func (f *FileSystem) CreateAsset(a *model.Asset, data []byte) error {

	dataFn := AssetFile(a)

	parentDir := filepath.Dir(dataFn)
	f.mkdir(parentDir)

	fp, err := f.Create(dataFn)
	if err != nil {
		return xerrors.Errorf("CreateFile() error: %w", err)
	}
	defer fp.Close()

	_, err = fp.Write(data)
	if err != nil {
		return xerrors.Errorf("Write() error: %w", err)
	}

	err = f.Commit(M("Create", a.Name), dataFn)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (f *FileSystem) DeleteAsset(a *model.Asset) error {

	fn := AssetFile(a)
	err := f.Remove(fn)
	if err != nil {
		return xerrors.Errorf("fs.Remove() error: %w", err)
	}

	err = f.Commit(M("Remove", a.Name), fn)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}
