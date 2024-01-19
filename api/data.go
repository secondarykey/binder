package api

import (
	"binder/db"
	"binder/db/model"

	"fmt"
)

func (a *App) EditData(d *model.Datum) (*model.Datum, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	//データを追加
	rtn, err := a.current.EditData(d, "")
	if err != nil {
		return nil, fmt.Errorf("EditData() error\n%+v", err)
	}
	return rtn, nil
}

func (a *App) GetData(id string, noteId string) (*model.Datum, error) {
	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}
	d, err := db.GetDatum(id, noteId)
	if err != nil {
		return nil, fmt.Errorf("GetDatum() error\n%+v", err)
	}
	return d, nil
}

func (a *App) OpenData(id, noteId string) (string, error) {

	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}

	data, err := a.current.ReadDataText(id, noteId)
	if err != nil {
		return "", fmt.Errorf("ReadDataText() error\n%+v", err)
	}

	return string(data), nil
}

func (a *App) SaveData(id, noteId string, data string) error {

	if a.current == nil {
		return fmt.Errorf("Not Open Binder")
	}

	err := a.current.WriteDataText(id, noteId, []byte(data))
	if err != nil {
		return fmt.Errorf("WriteDataText() error\n%+v", err)
	}

	return nil
}
