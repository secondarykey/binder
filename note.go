package binder

import (
	"binder/db/model"

	"golang.org/x/xerrors"
)

func (b *Binder) GetNote(id string) (*model.Note, error) {
	if b == nil {
		return nil, EmptyError
	}
	n, err := b.db.GetNote(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetNote() error: %w", err)
	}
	return n, nil
}

func (b *Binder) GetNoteWithTemplates(id string) (*model.Note, error) {

	if b == nil {
		return nil, EmptyError
	}

	n, err := b.db.GetNote(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetNote() error: %w", err)
	}

	layouts, contents, err := b.GetHTMLTemplates()
	if err != nil {
		return nil, xerrors.Errorf("db.GetHTMLTemplates() error: %w", err)
	}

	n.SetTemplates(layouts, contents)
	return n, nil
}

func (b *Binder) RemoveNote(id string) (*model.Note, error) {

	if b == nil {
		return nil, EmptyError
	}

	n, err := b.db.GetNote(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetNote() error: %w", err)
	}

	//ファイルを削除
	err = b.fileSystem.DeleteNote(id)
	if err != nil {
		return nil, xerrors.Errorf("fs.DeleteNote() error: %w", err)
	}
	//DBを削除
	err = b.db.DeleteNote(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteNote() error: %w", err)
	}
	return n, nil
}

func (b *Binder) EditNote(n *model.Note, metaName string) (*model.Note, error) {

	if b == nil {
		return nil, EmptyError
	}

	if n.Id == "" {

		n.Id = b.generateId()

		err := b.fileSystem.CreateNoteFile(n)
		if err != nil {
			return nil, xerrors.Errorf("fs.CreateNoteFile() error: %w", err)
		}

		err = b.db.InsertNote(n, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.InsertNote() error: %w", err)
		}

	} else {

		//TODO
		// Noteを取得して、Aliasを確認
		// すでにAliasが存在した場合、移動を行う
		//
		err := b.db.UpdateNote(n, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateNote() error: %w", err)
		}
	}

	//メタデータ指定がある場合
	if metaName != "" {

		//TODO すでに存在する場合

		err := b.fileSystem.EditMetadata(n, metaName)
		if err != nil {
			return nil, xerrors.Errorf("fs.EditMetadata() error: %w", err)
		}
	}

	return n, nil
}

func (b *Binder) OpenNote(noteId string) ([]byte, error) {
	if b == nil {
		return nil, EmptyError
	}

	data, err := b.fileSystem.ReadNoteText(noteId)
	if err != nil {
		return nil, xerrors.Errorf("fs.ReadNoteText() error: %w", err)
	}
	return data, nil
}

func (b *Binder) SaveNote(noteId string, data []byte) error {
	if b == nil {
		return EmptyError
	}
	err := b.fileSystem.WriteNoteText(noteId, data)
	if err != nil {
		return xerrors.Errorf("fs.WriteNoteText() error: %w", err)
	}
	return nil
}
