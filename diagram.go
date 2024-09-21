package binder

import (
	"binder/db/model"

	"golang.org/x/xerrors"
)

func (b *Binder) EditDiagram(d *model.Diagram) (*model.Diagram, error) {

	if b == nil {
		return nil, EmptyError
	}

	//新規指定だった場合
	if d.Id == "" {

		d.Id = b.generateId()

		err := b.fileSystem.CreateDiagramFile(d)
		if err != nil {
			return nil, xerrors.Errorf("fs.CreateDiagramFile() error: %w", err)
		}

		//DB設定
		err = b.db.InsertDiagram(d, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.InsertDiagram() error: %w", err)
		}
	} else {

		//TODO
		// Diagramを取得して、Aliasを確認
		// すでにAliasが存在した場合、移動を行う
		//

		err := b.db.UpdateDiagram(d, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateDiagram() error: %w", err)
		}
	}

	//TODO データベースをコミット

	return d, nil
}

func (b *Binder) GetDiagram(id string) (*model.Diagram, error) {
	if b == nil {
		return nil, EmptyError
	}
	d, err := b.db.GetDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetDiagram() error: %w", err)
	}
	return d, nil
}

func (b *Binder) OpenDiagram(id string) ([]byte, error) {
	if b == nil {
		return nil, EmptyError
	}
	data, err := b.fileSystem.ReadDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("fs.ReadDiagram() error: %w", err)
	}
	return data, nil
}

func (b *Binder) SaveDiagram(id string, data []byte) error {

	if b == nil {
		return EmptyError
	}
	err := b.fileSystem.WriteDiagram(id, data)
	if err != nil {
		return xerrors.Errorf("fs.WriteDiagram() error: %w", err)
	}

	return nil
}

func (b *Binder) RemoveDiagram(id string) (*model.Diagram, error) {

	if b == nil {
		return nil, EmptyError
	}

	d, err := b.db.GetDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetDiagram() error: %w", err)
	}

	//ファイルを削除
	err = b.fileSystem.DeleteDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("fs.DeleteDiagram() error: %w", err)
	}

	//DBを削除
	err = b.db.DeleteDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteNote() error: %w", err)
	}

	//TODO コミット

	return d, nil
}
