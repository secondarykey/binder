package binder

import (
	"binder/db/model"

	"golang.org/x/xerrors"
)

func (b *Binder) EditData(d *model.Datum, f string) (*model.Datum, error) {

	rtn, reg, err := b.fileSystem.EditData(d, f)
	if err != nil {
		return nil, xerrors.Errorf("fs.EditData() error: %w", err)
	}

	//TODO database
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
