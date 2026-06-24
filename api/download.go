package api

import (
	"binder/api/json"
	"binder/log"
)

// DownloadDocs はdocsディレクトリをZIPファイルとして指定パスに保存する。
func (a *App) DownloadDocs(savePath string) error {

	defer log.PrintTrace(log.Func("DownloadDocs()"))

	err := a.current.DownloadDocs(savePath)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

// DownloadAll はバインダー全体をZIPファイルとして指定パスに保存する。
func (a *App) DownloadAll(savePath string) error {

	defer log.PrintTrace(log.Func("DownloadAll()"))

	err := a.current.DownloadAll(savePath)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

// CollectExportDeps はノートZIPエクスポートに必要な依存関係を収集する。
func (a *App) CollectExportDeps(noteId string, text string) (*json.ExportDeps, error) {

	defer log.PrintTrace(log.Func("CollectExportDeps()"))

	deps, err := a.current.CollectExportDeps(noteId, text)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return deps, nil
}

// DownloadNote はノートを自己完結したZIPとしてエクスポートする。
func (a *App) DownloadNote(noteId string, text string, markedHTML string, diagramSVGs map[string]string, savePath string) error {

	defer log.PrintTrace(log.Func("DownloadNote()"))

	err := a.current.DownloadNote(noteId, text, markedHTML, diagramSVGs, savePath)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

// GetBinderName はバインダー名を返す。
func (a *App) GetBinderName() (string, error) {

	defer log.PrintTrace(log.Func("GetBinderName()"))

	name, err := a.current.GetBinderName()
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}
	return name, nil
}
