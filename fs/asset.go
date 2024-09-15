package fs

import (
	"binder/db/model"
	"io"
	"os"

	"golang.org/x/xerrors"
)

// ID 指定は上位でやっておく
func (b *FileSystem) CreateAsset(d *model.Asset, f string) error {

	dataF := AssetFile(d)

	fp, err := b.Create(dataF)
	if err != nil {
		return xerrors.Errorf("CreateFile() error: %w", err)
	}
	defer fp.Close()
	data, err := os.ReadFile(f)
	if err != nil {
		return xerrors.Errorf("ReadFile() error: %w", err)
	}
	_, err = fp.(io.Writer).Write(data)
	if err != nil {
		return xerrors.Errorf("Write() error: %w", err)
	}

	//TODO データのコミットを行う

	return nil
}

func (b *FileSystem) DeleteAsset(a *model.Asset) error {
	n := AssetFile(a)
	return b.Remove(n)
}
