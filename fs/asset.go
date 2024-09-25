package fs

import (
	"binder/db/model"
	"fmt"
	"path/filepath"

	"golang.org/x/xerrors"
)

func (f *FileSystem) CreateAsset(a *model.Asset, data []byte) error {

	dataFn := AssetFile(a)
	if dataFn == "" {
		return fmt.Errorf("AssetFile() error: id is empty(%s,%s)", a.ParentId, a.Id)
	}

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

	var files []string
	fn := PublicAssetFile(a)
	if f.isExist(fn) {
		err := f.Remove(fn)
		if err != nil {
			return xerrors.Errorf("fs.Remove(%s) error: %w", fn, err)
		}
		files = append(files, fn)
	}

	fn = AssetFile(a)
	err := f.Remove(fn)
	if err != nil {
		return xerrors.Errorf("fs.Remove(%s) error: %w", fn, err)
	}
	files = append(files, fn)

	err = f.Commit(M("Remove", a.Name), files...)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (f *FileSystem) UnpublishAsset(a *model.Asset) error {

	//公開ファイルを取得
	pub := PublicAssetFile(a)

	err := f.Remove(pub)
	if err != nil {
		return xerrors.Errorf("fs.Remove(%s) error: %w", pub, err)
	}

	err = f.Commit(M("Unpublish", a.Name), pub)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}

func (f *FileSystem) PublishAsset(a *model.Asset) error {

	//元ファイルを作成
	base := AssetFile(a)
	//公開ファイルを取得
	pub := PublicAssetFile(a)

	err := f.copyFile(pub, base)
	//err := f.copyFile(s[1], s[0])
	if err != nil {
		return xerrors.Errorf("copyFile() error: %w", err)
	}

	//コミット
	err = f.Commit(M("Publish", a.Name), pub)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (f *FileSystem) SetAssetStatus(a *model.Asset) error {

	//元ファイルを作成
	base := AssetFile(a)
	//公開ファイルを取得
	pub := PublicAssetFile(a)
	if pub == "" {
		return fmt.Errorf("public asset file error:[%s]", a.Id)
	}

	status, err := f.getPublishStatus(base, pub)
	if err != nil {
		//存在しないはエラー
		return xerrors.Errorf("getPublishStats() error: %w", err)
	}
	a.Status = status

	return nil
}
