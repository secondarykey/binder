package api

import (
	"binder/api/json"
	"binder/log"

	"fmt"
)

func (a *App) EditAsset(as *json.Asset, file string) (*json.Asset, error) {

	defer log.PrintTrace(log.Func("EditAsset()", as, file))

	//データを追加
	rtn, err := a.current.EditAsset(as, file)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("EditData() error\n%+v", err)
	}

	return rtn, nil
}

func (a *App) GetAsset(id string) (*json.Asset, error) {

	defer log.PrintTrace(log.Func("GetAsset()"))

	//データを追加
	rtn, err := a.current.GetAssetWithParent(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetAsset() error\n%+v", err)
	}

	return rtn, nil
}

func (a *App) DropAsset(as *json.Asset, filename string, base64data string) (*json.Asset, error) {

	defer log.PrintTrace(log.Func("DropAsset()", as, filename))

	rtn, err := a.current.DropAsset(as, filename, base64data)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("DropAsset() error\n%+v", err)
	}

	return rtn, nil
}

func (a *App) RemoveAsset(id string) error {
	defer log.PrintTrace(log.Func("RemoveAsset()"))
	_, err := a.current.RemoveAsset(id)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("RemoveAsset() error\n%+v", err)
	}
	return nil
}
