package api

import (
	"encoding/base64"
	"os"
	"path/filepath"

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

// ImportLocalFiles は OS のファイルパス一覧を受け取り、各ファイルを指定ノートのアセットとして登録する。
// Wails ネイティブファイルドロップ (EnableFileDrop) から Go ハンドラ経由で呼び出される。
func (a *App) ImportLocalFiles(parentId string, filePaths []string) error {

	defer log.PrintTrace(log.Func("ImportLocalFiles()", parentId))

	for _, p := range filePaths {
		data, err := os.ReadFile(p)
		if err != nil {
			return fmt.Errorf("ImportLocalFiles() error reading %s\n%+v", p, err)
		}
		filename := filepath.Base(p)
		b64 := base64.StdEncoding.EncodeToString(data)
		as := &json.Asset{
			ParentId: parentId,
			Name:     filename,
			Alias:    filename,
			Detail:   "",
			Binary:   false,
		}
		if _, err := a.current.DropAsset(as, filename, b64); err != nil {
			log.PrintStackTrace(err)
			return fmt.Errorf("ImportLocalFiles() DropAsset error\n%+v", err)
		}
	}
	return nil
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
