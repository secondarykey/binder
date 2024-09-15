package binder

import (
	"binder/db/model"
	"log/slog"

	"golang.org/x/xerrors"
)

func (b *Binder) GetNote(id string) (*model.Note, error) {
	return b.db.GetNote(id)
}

func (b *Binder) GetNoteWithTemplates(id string) (*model.Note, error) {
	n, err := b.db.GetNote(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetNote() error: %w", err)
	}

	layouts, contents, err := b.db.GetHTMLTemplates()
	if err != nil {
		return nil, xerrors.Errorf("db.GetNote() error: %w", err)
	}

}

func (b *Binder) RemoveNote(id string) (*model.Note, error) {

	//ファイルを削除
	err := b.fileSystem.DeleteNote(id)
	if err != nil {
		return nil, xerrors.Errorf("fs.DeleteNote() error: %w", err)
	}
	//TODO 現状は削除しているが、ID自体はゴミ箱に入れておいていいかも
	err = b.db.DeleteNote(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteNote() error: %w", err)
	}
	return nil, nil
}

func (b *Binder) EditNote(n *model.Note, imageName string) (*model.Note, error) {

	slog.Info("Call EditNote()")

	rtn, reg, err := b.fileSystem.EditNote(n, imageName)
	if err != nil {
		return nil, xerrors.Errorf("fs.EditNote() error: %w", err)
	}

	if reg {
		err = b.db.InsertNote(n, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.InsertNote() error: %w", err)
		}
	} else {
		err = b.db.UpdateNote(n, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateNote() error: %w", err)
		}
	}

	//TODO データベースのコミット

	return rtn, nil
}

func (b *Binder) GetLatestNoteId() (string, error) {
	id, err := b.db.GetLatestNoteId()
	if err != nil {
		return "", xerrors.Errorf("db.GetLatestNoteId() error: %w", err)
	}
	return id, nil
}

func (b *Binder) OpenNote(noteId string) ([]byte, error) {
	return b.fileSystem.ReadNoteText(noteId)
}

func (b *Binder) SaveNote(noteId string, data []byte) error {
	return b.fileSystem.WriteNoteText(noteId, data)
}
