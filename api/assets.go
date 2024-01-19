package api

import (
	"binder/db/model"

	"fmt"
)

func (a *App) EditAssets(d *model.Datum, file string) (*model.Datum, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}
	//データを追加
	rtn, err := a.current.EditData(d, file)
	if err != nil {
		return nil, fmt.Errorf("EditData() error\n%+v", err)
	}

	return rtn, nil
}
