package fs

import (
	"binder/db"
	"binder/db/model"
	"time"

	uuid "github.com/google/uuid"
	"golang.org/x/xerrors"
)

func (b *Binder) ExistsData(id, noteId string) bool {
	return db.ExistDatum(id, noteId)
}

func (b *Binder) RegisterData(id, noteId string, name string) (*model.Datum, error) {

	if id == "" {
		id = uuid.New().String()
	}

	n := DataTextFile(id, noteId)
	//ノートファイルを作成
	_, err := b.Create(n)
	if err != nil {
		return nil, xerrors.Errorf("binder Create() error: %w", err)
	}
	err = b.Commit("create: data file")
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	var d model.Datum
	d.ID = id
	d.NoteId = noteId
	d.Name = name
	d.Detail = ""

	now := time.Now()
	d.Created = now
	d.Updated = now

	//DBに追加
	err = db.InsertDatum(&d)
	if err != nil {
		return nil, xerrors.Errorf("db.RegisterDatum() error: %w", err)
	}

	err = b.Commit("update: database")
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return &d, nil
}
