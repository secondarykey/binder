package binder

import (
	"binder/db/model"

	"golang.org/x/xerrors"
)

func (b *Binder) GetNote(id string) (*model.Note, error) {
	return b.db.GetNote(id)
}

func (b *Binder) EditNote(n *model.Note, imageName string) (*model.Note, error) {

	rtn, reg, err := b.fileSystem.EditNote(n, imageName)
	if err != nil {
		return nil, xerrors.Errorf("fs.EditNote() error: %w", err)
	}

	if reg {
		err = b.db.InsertNote(n)
		if err != nil {
			return nil, xerrors.Errorf("db.InsertNote() error: %w", err)
		}
	} else {
		err = b.db.UpdateNote(n)
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
