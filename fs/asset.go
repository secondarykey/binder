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

// RenamePublishedAsset は公開済みのアセットファイルを旧aliasから新aliasへ移動する。
// 対象: docs/assets/{alias}
// ファイルが存在しない場合はスキップする。変更されたファイルパスのスライスを返す。
func (f *FileSystem) RenamePublishedAsset(oldAlias, newAlias string) ([]string, error) {
	oldPub := publicAssetFile(oldAlias)
	newPub := publicAssetFile(newAlias)
	if !f.isExist(oldPub) {
		return nil, nil
	}

	if err := f.copyFile(newPub, oldPub); err != nil {
		return nil, xerrors.Errorf("copyFile(%s) error: %w", oldPub, err)
	}
	if err := f.remove(oldPub); err != nil {
		return nil, xerrors.Errorf("remove(%s) error: %w", oldPub, err)
	}

	return []string{oldPub, newPub}, nil
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

func (f *FileSystem) WriteAssetText(id string, data []byte) error {

	n := assetFile(id)
	fp, err := f.Create(n)
	if err != nil {
		return fmt.Errorf("Open() error\n%+v", err)
	}
	defer fp.Close()

	_, err = fp.Write(data)
	if err != nil {
		return fmt.Errorf("Write() error\n%+v", err)
	}
	return nil
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
