package fs

import (
	"binder/db/model"
	"os"

	"golang.org/x/xerrors"
)

func (f *FileSystem) CreateAsset(a *model.Asset, fn string) error {

	data, err := os.ReadFile(fn)
	if err != nil {
		return xerrors.Errorf("ReadFile() error: %w", err)
	}

	dataFn := AssetFile(a)
	if dataFn == "" {
		return xerrors.Errorf("ReadFile() error: %w", err)
	}

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
