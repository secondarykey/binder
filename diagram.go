package binder

import (
	"binder/db/model"
	"log/slog"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
)

func (b *Binder) EditDiagram(d *model.Diagram) (*model.Diagram, error) {

	slog.Info("Call EditDiagram()")

	//新規指定だった場合
	if d.Id == "" {
		id, err := uuid.NewV7()
		if err != nil {
			return nil, xerrors.Errorf("uuid.NewV7() error: %w", err)
		}
		d.Id = id.String()

		err = b.fileSystem.CreateDiagramFile(d)
		if err != nil {
			return nil, xerrors.Errorf("fs.EditDiagram() error: %w", err)
		}
		err = b.db.InsertDiagram(d, b.op)
		if err != nil {
			return nil, xerrors.Errorf("fs.InsertDiagram() error: %w", err)
		}
	} else {
		err := b.db.UpdateDiagram(d, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateDiagram() error: %w", err)
		}
	}

	//TODO データベースをコミット

	return d, nil
}

func (b *Binder) RemoveDiagram(id string) (*model.Diagram, error) {

	//ファイルを削除
	err := b.fileSystem.DeleteDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("fs.DeleteDiagram() error: %w", err)
	}
	err = b.db.DeleteDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteNote() error: %w", err)
	}
	return nil, nil
}

func (b *Binder) GetDiagram(id string) (*model.Diagram, error) {
	return b.db.GetDiagram(id)
}

func (b *Binder) OpenDiagram(id string) ([]byte, error) {
	return b.fileSystem.ReadDiagram(id)
}

func (b *Binder) SaveDiagram(id string, data []byte) error {
	return b.fileSystem.WriteDiagram(id, data)
}
