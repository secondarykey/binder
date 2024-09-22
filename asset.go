package binder

import (
	"binder/db/model"
	"os"
	"path/filepath"

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
