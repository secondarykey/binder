package binder

import (
	"binder/db/model"
	"binder/fs"
	"fmt"
	"time"

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

func (b *Binder) GetPublishNotes() ([]*model.Note, error) {

	all, err := b.db.FindNotes()
	if err != nil {
		return nil, xerrors.Errorf("db.FindNotes() error: %w", err)
	}

	pr := make([]*model.Note, 0, len(all))

	for _, n := range all {

		//元ファイルを作成
		base := fs.NoteFile(n.Id)
		//公開ファイルを取得
		pub := fs.HTMLFile(n)
		p := fs.ConvertPaths(base, pub)

		bi, err := b.fileSystem.Stat(p[0])
		bt := time.Now()
		if err == nil {
			bt = bi.ModTime()
		} else {
			//存在しないはエラー
			return nil, fmt.Errorf("diagram file Nothing[%s]", n.Id)
		}

		pi, err := b.fileSystem.Stat(p[1])
		pt := time.Time{}
		if err == nil {
			pt = pi.ModTime()

			if bt.After(pt) {
				n.Status = model.UpdatedStatus
			} else {
				n.Status = model.LatestStatus
			}
		} else {
			n.Status = model.PrivateStatus
		}

		//最新じゃない場合は追加
		if n.Status != model.LatestStatus {
			pr = append(pr, n)
		}
	}
	return pr, nil
}
