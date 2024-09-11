package api

import (
	"binder/db/model"

	"fmt"
)

func (a *App) EditAsset(d *model.Asset, file string) (*model.Asset, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	//データを追加
	rtn, err := a.current.EditAsset(d, file)
	if err != nil {
		return nil, fmt.Errorf("EditData() error\n%+v", err)
	}

	return rtn, nil
}

func (a *App) GetAsset(id string) (*model.Asset, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	//データを追加
	rtn, err := a.current.GetAsset(id)
	if err != nil {
		return nil, fmt.Errorf("GetAsset() error\n%+v", err)
	}

	return rtn, nil
}
