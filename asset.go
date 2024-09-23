package binder

import (
	"binder/db/model"
	"binder/fs"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/xerrors"
)

func (b *Binder) EditAsset(a *model.Asset, f string) (*model.Asset, error) {

	if b == nil {
		return nil, EmptyError
	}

	var data []byte
	var err error
	//ファイル指定がある場合
	if f != "" {

		data, err = os.ReadFile(f)
		if err != nil {
			return nil, xerrors.Errorf("os.ReadFile() error: %w", err)
		}

		fn := filepath.Base(f)
		//指定がない状態だった場合、ファイル名で設定しておく
		if a.Id == "" {
			a.Name = fn
			a.Alias = fn
		}
	}

	_, err = b.editAsset(a, data)
	if err != nil {
		return nil, xerrors.Errorf("editAsset() error: %w", err)
	}

	return a, nil
}

func (b *Binder) editAsset(a *model.Asset, data []byte) (*model.Asset, error) {

	//新規指定だった場合
	if a.Id == "" {

		a.Id = b.generateId()
		n, err := b.db.GetNote(a.ParentId)
		if err != nil {
			return nil, xerrors.Errorf("db.GetNote() error: %w", err)
		}
		a.SetParent(n)

		err = b.db.InsertAsset(a, b.op)
		if err != nil {
			return nil, xerrors.Errorf("fs.InsertAsset() error: %w", err)
		}

	} else {

		//TODO Alias変更時に影響あり

		err := b.db.UpdateAsset(a, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateAsset() error: %w", err)
		}
	}

	// データ指定がある場合
	if data != nil {
		err := b.fileSystem.CreateAsset(a, data)
		if err != nil {
			return nil, xerrors.Errorf("fs.CreateAsset() error: %w", err)
		}
	}

	return a, nil
}

func (b *Binder) GetAsset(id string) (*model.Asset, error) {
	if b == nil {
		return nil, EmptyError
	}
	a, err := b.db.GetAsset(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetAsset() error: %w", err)
	}
	return a, nil
}

func (b *Binder) GetAssetWithParent(id string) (*model.Asset, error) {
	if b == nil {
		return nil, EmptyError
	}
	a, err := b.db.GetAssetWithParent(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetAssetWithParent() error: %w", err)
	}
	return a, nil
}

func (b *Binder) RemoveAsset(id string) (*model.Asset, error) {

	if b == nil {
		return nil, EmptyError
	}

	//TODO 公開されている状態だったら？

	a, err := b.db.GetAssetWithParent(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetAsset() error: %w", err)
	}

	//DBを削除
	err = b.db.DeleteAsset(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteAsset() error: %w", err)
	}

	//ファイルを削除
	err = b.fileSystem.DeleteAsset(a)
	if err != nil {
		return nil, xerrors.Errorf("fs.RemoveAsset() error: %w", err)
	}

	return a, nil
}

func (b *Binder) GetPublishAssets() ([]*model.Asset, error) {

	all, err := b.db.FindAssetWithParent()
	if err != nil {
		return nil, xerrors.Errorf("db.FindAssets() error: %w", err)
	}

	pr := make([]*model.Asset, 0, len(all))

	for _, a := range all {

		//元ファイルを作成
		base := fs.AssetFile(a)
		//公開ファイルを取得
		pub := fs.PublicAssetFile(a)
		p := fs.ConvertPaths(base, pub)

		bi, err := b.fileSystem.Stat(p[0])
		bt := time.Now()
		if err == nil {
			bt = bi.ModTime()
		} else {
			//存在しないはエラー
			return nil, fmt.Errorf("asset file Nothing[%s]", a.Id)
		}

		pi, err := b.fileSystem.Stat(p[1])
		pt := time.Time{}
		if err == nil {
			pt = pi.ModTime()

			if bt.After(pt) {
				a.Status = model.UpdatedStatus
			} else {
				a.Status = model.LatestStatus
			}
		} else {
			a.Status = model.PrivateStatus
		}

		//最新じゃない場合は追加
		if a.Status != model.LatestStatus {
			pr = append(pr, a)
		}
	}
	return pr, nil
}
