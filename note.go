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

	var on *model.Note

	if n.Id == "" {

		n.Id = b.generateId()
		err := b.createNote(n)
		if err != nil {
			return nil, xerrors.Errorf("createNote() error: %w", err)
		}

	} else {

		var err error
		on, err = b.db.GetNote(n.Id)
		if on.Alias != n.Alias {
			//TODO
			//旧データが公開されてないか確認

			//Metaデータが公開されてないかも確認
		}

		err = b.db.UpdateNote(n, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateNote() error: %w", err)
		}
	}

	//メタデータ指定がある場合
	if metaName != "" {
		err := b.fileSystem.EditMetadata(n, metaName)
		if err != nil {
			return nil, xerrors.Errorf("fs.EditMetadata() error: %w", err)
		}
	}

	return n, nil
}

func (b *Binder) createNote(n *model.Note) error {
	err := b.fileSystem.CreateNoteFile(n)
	if err != nil {
		return xerrors.Errorf("fs.CreateNoteFile() error: %w", err)
	}

	err = b.db.InsertNote(n, b.op)
	if err != nil {
		return xerrors.Errorf("db.InsertNote() error: %w", err)
	}
	return nil
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

func (b *Binder) diffrenceNotes() error {

	//DBからノートを取得

	//ファイルシステムから一覧を取得

	//DBにあって、ファイルシステムにない
	//ファイルを追加

	//ファイルシステムにあって、DBにない
	//削除する

	//公開状況を取得
	//他のものがないか？

	return nil
}
