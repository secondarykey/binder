package binder

import (
	"binder/db/model"
	"path/filepath"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
)

func (b *Binder) EditAsset(a *model.Asset, f string) (*model.Asset, error) {

	if b == nil {
		return nil, EmptyError
	}

	//新規指定だった場合
	if a.Id == "" {
		//TODO ID の使用を考える
		id, err := uuid.NewV7()
		if err != nil {
			return nil, xerrors.Errorf("uuid.NewV7() error: %w", err)
		}

		a.Id = id.String()
		fn := filepath.Base(f)
		a.Name = fn
		a.Alias = fn

		if b.db.ExistAsset(a.Id) {
			return nil, xerrors.Errorf("Exist Asset error")
		}

		n, err := b.db.GetNote(a.ParentId)
		if err != nil {
			return nil, xerrors.Errorf("db.GetNote() error: %w", err)
		}
		a.SetParent(n)

		err = b.db.InsertAsset(a, b.op)
		if err != nil {
			return nil, xerrors.Errorf("fs.InsertAsset() error: %w", err)
		}

		err = b.fileSystem.CreateAsset(a, f)
		if err != nil {
			return nil, xerrors.Errorf("fs.CreateAsset() error: %w", err)
		}
	} else {
		err := b.db.UpdateAsset(a, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateAsset() error: %w", err)
		}
	}

	//TODO データベースをコミット

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
