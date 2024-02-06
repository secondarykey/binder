package binder

import (
	"binder/db/model"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
)

func (b *Binder) EditData(d *model.Datum, f string) (*model.Datum, error) {

	reg := false
	//新規指定だった場合
	if d.ID == "" {
		reg = true
		if f == "" {
			d.ID = uuid.New().String()
		} else {
			fn := filepath.Base(f)
			d.ID = fn
			d.Name = fn
			if b.db.ExistDatum(d.ID, d.NoteId) {
				return nil, xerrors.Errorf("Exist Datum error")
			}
			//Asset時は公開日を設定しておく
			d.Publish = time.Now()
		}
	}

	rtn, err := b.fileSystem.EditData(d, f, reg)
	if err != nil {
		return nil, xerrors.Errorf("fs.EditData() error: %w", err)
	}

	//TODO asset の新規作成時は公開日付を設定
	if reg && f != "" {
	}

	if reg {
		err = b.db.InsertDatum(rtn)
		if err != nil {
			return nil, xerrors.Errorf("fs.InsertData() error: %w", err)
		}
	} else {
		b.db.UpdateDatum(rtn)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateData() error: %w", err)
		}
	}

	//TODO データベースをコミット

	return rtn, nil
}

func (b *Binder) GetData(id string, noteId string) (*model.Datum, error) {
	return b.db.GetDatum(id, noteId)
}

func (b *Binder) OpenData(id, noteId string) ([]byte, error) {
	return b.fileSystem.ReadDataText(id, noteId)
}

func (b *Binder) SaveData(id, noteId string, data []byte) error {
	return b.fileSystem.WriteDataText(id, noteId, data)
}
