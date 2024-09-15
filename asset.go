package binder

import (
	"binder/db/model"
	"path/filepath"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
)

func (b *Binder) EditAsset(d *model.Asset, f string) (*model.Asset, error) {

	//新規指定だった場合
	if d.Id == "" {
		//TODO ID の使用を考える
		id, err := uuid.NewV7()
		if err != nil {
			return nil, xerrors.Errorf("uuid.NewV7() error: %w", err)
		}

		d.Id = id.String()
		fn := filepath.Base(f)
		d.Name = fn
		d.Alias = fn

		if b.db.ExistAsset(d.Id) {
			return nil, xerrors.Errorf("Exist Asset error")
		}

		n, err := b.db.GetNote(d.ParentId)
		if err != nil {
			return nil, xerrors.Errorf("db.GetNote() error: %w", err)
		}
		d.SetParent(n)

		err = b.db.InsertAsset(d, b.op)
		if err != nil {
			return nil, xerrors.Errorf("fs.InsertAsset() error: %w", err)
		}

		err = b.fileSystem.CreateAsset(d, f)
		if err != nil {
			return nil, xerrors.Errorf("fs.CreateAsset() error: %w", err)
		}
	} else {
		err := b.db.UpdateAsset(d, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateAsset() error: %w", err)
		}
	}

	//TODO データベースをコミット

	return d, nil
}

func (b *Binder) GetAsset(id string) (*model.Asset, error) {
	return b.db.GetAsset(id)
}

func (b *Binder) GetAssetWithParent(id string) (*model.Asset, error) {
	return b.db.GetAssetWithParent(id)
}

func (b *Binder) RemoveAsset(id string) (*model.Asset, error) {

	a, err := b.db.GetAsset(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetAsset() error: %w", err)
	}
	n, err := b.db.GetNote(a.ParentId)
	if err != nil {
		return nil, xerrors.Errorf("db.GetNote() error: %w", err)
	}

	//DBを削除
	err = b.db.DeleteAsset(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteAsset() error: %w", err)
	}

	a.SetParent(n)
	//ファイルを削除
	err = b.fileSystem.DeleteAsset(a)
	if err != nil {
		return nil, xerrors.Errorf("fs.RemoveAsset() error: %w", err)
	}

	return a, nil
}
