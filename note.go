package binder

import (
	"binder/db/model"
	"binder/fs"
	"fmt"

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

	err = b.fileSystem.SetNoteStatus(n)
	if err != nil {
		return nil, xerrors.Errorf("fs.SetNoteStatus() error: %w", err)
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

	//TODO 親に持つオブジェクトをすべて取得

	//ファイルを削除
	files, err := b.fileSystem.DeleteNote(n)
	if err != nil {
		return nil, xerrors.Errorf("fs.DeleteNote() error: %w", err)
	}

	//DBを削除
	err = b.db.DeleteNote(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteNote() error: %w", err)
	}

	files = append(files, fs.NoteTableFile())

	//コミット
	err = b.fileSystem.Commit(fs.M("Remove Note", n.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return n, nil
}

func (b *Binder) EditNote(n *model.Note, metaName string) (*model.Note, error) {

	if b == nil {
		return nil, EmptyError
	}

	var prefix string
	var files []string
	var on *model.Note

	if n.Id == "" {

		n.Id = b.generateId()
		fn, err := b.createNote(n)

		if err != nil {
			return nil, xerrors.Errorf("createNote() error: %w", err)
		}

		files = append(files, fn)

		prefix = "Create Note"

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

		prefix = "Update Note"
	}

	//メタデータ指定がある場合
	if metaName != "" {
		meta, err := b.fileSystem.EditMetadata(n, metaName)
		if err != nil {
			return nil, xerrors.Errorf("fs.EditMetadata() error: %w", err)
		}

		files = append(files, meta)
	}

	files = append(files, fs.NoteTableFile())
	//コミット
	err := b.fileSystem.Commit(fs.M(prefix, n.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return n, nil
}

// ノートの作成を行う
func (b *Binder) createNote(n *model.Note) (string, error) {

	fn, err := b.fileSystem.CreateNoteFile(n)
	if err != nil {
		return "", xerrors.Errorf("fs.CreateNoteFile() error: %w", err)
	}

	err = b.db.InsertNote(n, b.op)
	if err != nil {
		return "", xerrors.Errorf("db.InsertNote() error: %w", err)
	}
	return fn, nil
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

func (b *Binder) GetUnpublishedNotes() ([]*model.Note, error) {

	all, err := b.db.FindNotes()
	if err != nil {
		return nil, xerrors.Errorf("db.FindNotes() error: %w", err)
	}

	pr := make([]*model.Note, 0, len(all))
	for _, n := range all {

		err = b.fileSystem.SetNoteStatus(n)
		if err != nil {
			return nil, xerrors.Errorf("fs.SetNoteStatus() error: %w", err)
		}
		//最新じゃない場合は追加
		if n.PublishStatus != model.LatestStatus {
			pr = append(pr, n)
		}
	}
	return pr, nil
}

func (b *Binder) CommitNote(id string, m string) error {
	f := fs.NoteFile(id)
	err := b.fileSystem.Commit(m, f)
	if err != nil {
		return xerrors.Errorf("fs.Commit() error: %w", err)
	}
	return nil
}

func (b *Binder) PublishNote(id string, data []byte) (*model.Note, error) {

	n, err := b.db.GetNote(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetNote() error: %w", err)
	}

	//TODO Publish dateがない場合

	fn, err := b.fileSystem.PublishNote(data, n)
	if err != nil {
		return nil, xerrors.Errorf("fs.PublishNote() error: %w", err)
	}

	//TODO コミット
	fmt.Println(fn)

	return n, nil
}
