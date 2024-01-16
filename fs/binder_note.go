package fs

import (
	"binder/db"
	"binder/db/model"
	"io"
	"os"
	"time"

	uuid "github.com/google/uuid"
	"golang.org/x/xerrors"
)

func (b *Binder) ExistsNote(noteId string) bool {
	return db.ExistNote(noteId)
}

func (b *Binder) RegisterNote(noteId string, name string, image string) (*model.Note, error) {

	if noteId == "" {
		noteId = uuid.New().String()
	}

	//ノートファイルを作成
	_, err := b.Create(NoteTextFile(noteId))
	if err != nil {
		return nil, xerrors.Errorf("binder Create() error: %w", err)
	}
	err = b.Commit("create: note file")
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	//画像指定がある場合画像を作成
	if image != "" {
		dir := "docs/" + noteId
		b.Mkdir(dir)
		fp, err := b.Create(dir + "/index")
		if err != nil {
			return nil, xerrors.Errorf("binder Create() error: %w", err)
		}
		defer fp.Close()

		data, err := os.ReadFile(image)
		if err != nil {
			return nil, xerrors.Errorf("image file ReadFile() error: %w", err)
		}

		_, err = fp.(io.Writer).Write(data)
		if err != nil {
			return nil, xerrors.Errorf("writer Write() error: %w", err)
		}
		err = b.Commit("create: note image")
		if err != nil {
			return nil, xerrors.Errorf("Commit() error: %w", err)
		}
	}

	var n model.Note
	n.ID = noteId
	n.Title = name
	n.Detail = "-"

	now := time.Now()
	n.Created = now
	n.Updated = now

	//DBに追加
	err = db.InsertNote(&n)
	if err != nil {
		return nil, xerrors.Errorf("db.RegisterNote() error: %w", err)
	}

	err = b.Commit("update: database")
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return &n, nil
}
