package api

import (
	"binder/log"
	"fmt"
)

// DownloadDocs はdocsディレクトリをZIPファイルとして指定パスに保存する。
func (a *App) DownloadDocs(savePath string) error {

	defer log.PrintTrace(log.Func("DownloadDocs()"))

	err := a.current.DownloadDocs(savePath)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("DownloadDocs() error\n%+v", err)
	}
	return nil
}

// GetBinderName はバインダー名を返す。
func (a *App) GetBinderName() (string, error) {

	defer log.PrintTrace(log.Func("GetBinderName()"))

	name, err := a.current.GetBinderName()
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("GetBinderName() error\n%+v", err)
	}
	return name, nil
}
