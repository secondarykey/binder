package fs

import (
	"binder/db"
	"binder/db/model"
	"fmt"
	"io"
	stdFs "io/fs"
	"os"
	"time"

	uuid "github.com/google/uuid"
	"golang.org/x/xerrors"
)

func (b *Binder) ExistsNote(noteId string) bool {
	return db.ExistNote(noteId)
}

func (b *Binder) EditNote(n *model.Note, image string) (*model.Note, error) {

	regFlag := false
	now := time.Now()

	if n.ID == "" {
		n.ID = uuid.New().String()
		regFlag = true
	}

	//ノートファイルを作成
	if regFlag {
		_, err := b.Create(NoteTextFile(n.ID))
		if err != nil {
			return nil, xerrors.Errorf("binder Create() error: %w", err)
		}
		err = b.Commit("create: note file")
		if err != nil {
			return nil, xerrors.Errorf("Commit() error: %w", err)
		}
		n.Created = now
	}

	//画像指定がある場合画像を作成
	if image != "" {

		//TODO 存在する場合は更新になります
		fp, err := b.Create(noteImage(n.ID))
		if err != nil {
			return nil, xerrors.Errorf("binder Create() error: %w", err)
		}
		defer fp.Close()

		//ローカルファイルを取得
		data, err := os.ReadFile(image)
		if err != nil {
			return nil, xerrors.Errorf("image file ReadFile() error: %w", err)
		}

		//それを書き込む
		_, err = fp.(io.Writer).Write(data)
		if err != nil {
			return nil, xerrors.Errorf("writer Write() error: %w", err)
		}

		err = b.Commit("create: note image")
		if err != nil {
			return nil, xerrors.Errorf("Commit() error: %w", err)
		}
	}

	n.Updated = now

	if regFlag {
		//DBに追加
		err := db.InsertNote(n)
		if err != nil {
			return nil, xerrors.Errorf("db.InsertNote() error: %w", err)
		}
	} else {
		err := db.UpdateNote(n)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateNote() error: %w", err)
		}
	}

	err := b.Commit("update: database")
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return n, nil
}

func (b *Binder) ReadNoteText(id string) ([]byte, error) {
	n := NoteTextFile(id)
	data, err := stdFs.ReadFile(b, n)
	if err != nil {
		return nil, xerrors.Errorf("fs.ReadFile() error: %w", err)
	}
	return data, nil
}

func (b *Binder) WriteNoteText(id string, data []byte) error {

	n := NoteTextFile(id)
	fp, err := b.Open(n)
	if err != nil {
		return fmt.Errorf("Open() error\n%+v", err)
	}
	defer fp.Close()

	_, err = fp.(io.Writer).Write(data)
	if err != nil {
		return fmt.Errorf("Write() error\n%+v", err)
	}
	return nil
}
