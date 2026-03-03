package fs

import (
	"binder/api/json"
	"fmt"

	"golang.org/x/xerrors"
)

func (f *FileSystem) CreateAsset(a *json.Asset, data []byte) (string, error) {

	dataFn := AssetFile(a)
	if dataFn == "" {
		return "", fmt.Errorf("AssetFile() error: id is empty(%s)", a.Id)
	}

	f.mkdir(AssetDir)

	fp, err := f.Create(dataFn)
	if err != nil {
		return "", xerrors.Errorf("CreateFile() error: %w", err)
	}
	defer fp.Close()

	_, err = fp.Write(data)
	if err != nil {
		return "", xerrors.Errorf("Write() error: %w", err)
	}

	return dataFn, nil
}

func (f *FileSystem) DeleteAsset(a *json.Asset) ([]string, error) {

	var files []string
	fn := PublicAssetFile(a)

	if f.isExist(fn) {
		files = append(files, fn)
	}

	fn = AssetFile(a)
	if f.isExist(fn) {
		files = append(files, fn)
	} else {
		return nil, xerrors.Errorf("NotExist: %s", fn)
	}

	err := f.remove(files...)
	if err != nil {
		return nil, xerrors.Errorf("remove() error: %w", err)
	}

	return files, nil
}

func (f *FileSystem) UnpublishAsset(a *json.Asset) (string, error) {

	//公開ファイルを取得
	pub := PublicAssetFile(a)
	err := f.remove(pub)
	if err != nil {
		return "", xerrors.Errorf("remove(%s) error: %w", pub, err)
	}

	return pub, nil
}

func (f *FileSystem) PublishAsset(a *json.Asset) (string, error) {

	//元ファイルを作成
	base := AssetFile(a)
	//公開ファイルを取得
	pub := PublicAssetFile(a)

	err := f.copyFile(pub, base)
	if err != nil {
		return "", xerrors.Errorf("copyFile() error: %w", err)
	}

	return pub, nil
}

func (f *FileSystem) SetAssetStatus(a *json.Asset) error {

	//元ファイルを作成
	base := AssetFile(a)
	//公開ファイルを取得
	pub := PublicAssetFile(a)
	if pub == "" {
		return fmt.Errorf("public asset file error:[%s]", a.Id)
	}

	us, ps, err := f.getStatus(base, pub)
	if err != nil {
		//存在しないはエラー
		return xerrors.Errorf("getPublishStats() error: %w", err)
	}
	a.UpdatedStatus = us
	a.PublishStatus = ps

	return nil
}
