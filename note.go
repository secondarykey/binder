package binder

import (
	"binder/db/model"
	"fmt"

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

	return rtn, nil
}

func (b *Binder) OpenNote(noteId string) ([]byte, error) {

	nId := noteId
	if noteId == "" {
		nId = b.db.GetLatestNoteId()
		if nId == "" {
			return nil, fmt.Errorf("Note not found.")
		}
	}

	return b.fileSystem.ReadNoteText(nId)
}

func (b *Binder) SaveNote(noteId string, data []byte) error {
	return b.fileSystem.WriteNoteText(noteId, data)
}
