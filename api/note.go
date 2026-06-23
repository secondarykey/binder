package api

import (
	"binder/api/json"
	"binder/log"
	"strings"
)

func (a *App) EditNote(n *json.Note, imageName string) (*json.Note, error) {

	defer log.PrintTrace(log.Func("EditNote()"))

	//ノートを追加
	n, err := a.current.EditNote(n, imageName)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}

	return n, nil
}

func (a *App) RemoveNote(id string) error {

	defer log.PrintTrace(log.Func("RemoveNote()"))

	_, err := a.current.RemoveNote(id)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) GetNote(id string) (*json.Note, error) {

	defer log.PrintTrace(log.Func("GetNote()"))

	n, err := a.current.GetNote(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}

	return n, nil
}

// GetNoteImageURL はノートのメタ画像を data URI で返す。
// assets/meta/{noteId} が存在する場合は data:{mime};base64,... を返し、
// 存在しない場合は空文字を返す。HTTPサーバに依存しない。
func (a *App) GetNoteImageURL(noteId string) (string, error) {

	defer log.PrintTrace(log.Func("GetNoteImageURL()"))

	uri, err := a.current.MetaImageDataURI(noteId)
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}

	return uri, nil
}

// UploadNoteImage はノートのメタ画像ファイルをアップロードする。
func (a *App) UploadNoteImage(noteId string, filePath string) error {

	defer log.PrintTrace(log.Func("UploadNoteImage()"))

	err := a.current.UploadNoteImage(noteId, filePath)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

// DeleteNoteImage はノートのメタ画像ファイルを削除する。
func (a *App) DeleteNoteImage(noteId string) error {

	defer log.PrintTrace(log.Func("DeleteNoteImage()"))

	err := a.current.DeleteNoteImage(noteId)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) OpenNote(noteId string) (string, error) {

	defer log.PrintTrace(log.Func("OpenNote()"))

	var w strings.Builder

	err := a.current.ReadNote(&w, noteId)
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}
	return w.String(), nil
}

// PrivatizeChildren は指定ノートの全子孫を非公開化する。
func (a *App) PrivatizeChildren(noteId string) error {

	defer log.PrintTrace(log.Func("PrivatizeChildren()"))

	if err := a.current.PrivatizeChildren(noteId); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) SaveNote(noteId string, data string) error {

	defer log.PrintTrace(log.Func("SaveNote()"))

	err := a.current.SaveNote(noteId, []byte(data))
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}

	return nil
}
