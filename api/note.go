package api

import (
	"binder/api/json"
	"binder/log"
	"strings"

	"fmt"
)

func (a *App) EditNote(n *json.Note, imageName string) (*json.Note, error) {

	defer log.PrintTrace(log.Func("EditNote()"))

	//ノートを追加
	n, err := a.current.EditNote(n, imageName)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("EditNote() error\n%+v", err)
	}

	return n, nil
}

func (a *App) RemoveNote(id string) error {

	defer log.PrintTrace(log.Func("RemoveNote()"))

	_, err := a.current.RemoveNote(id)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("RemoveNote() error\n%+v", err)
	}
	return nil
}

func (a *App) GetNote(id string) (*json.Note, error) {

	defer log.PrintTrace(log.Func("GetNote()"))

	n, err := a.current.GetNote(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetNote() error\n%+v", err)
	}

	return n, nil
}

// GetNoteImageURL はノートのメタ画像URLを返す。
// assets/meta/{noteId} が存在する場合は HTTP URL を返し、存在しない場合は空文字を返す。
func (a *App) GetNoteImageURL(noteId string) (string, error) {

	defer log.PrintTrace(log.Func("GetNoteImageURL()"))

	data, err := a.current.ReadMetaBytes(noteId)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("GetNoteImageURL() error\n%+v", err)
	}
	if data == nil {
		return "", nil
	}

	addr := a.current.ServerAddress()
	if addr == "" {
		return "", nil
	}

	return fmt.Sprintf("http://%s/binder-meta/%s", addr, noteId), nil
}

// UploadNoteImage はノートのメタ画像ファイルをアップロードする。
func (a *App) UploadNoteImage(noteId string, filePath string) error {

	defer log.PrintTrace(log.Func("UploadNoteImage()"))

	err := a.current.UploadNoteImage(noteId, filePath)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("UploadNoteImage() error\n%+v", err)
	}
	return nil
}

// DeleteNoteImage はノートのメタ画像ファイルを削除する。
func (a *App) DeleteNoteImage(noteId string) error {

	defer log.PrintTrace(log.Func("DeleteNoteImage()"))

	err := a.current.DeleteNoteImage(noteId)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("DeleteNoteImage() error\n%+v", err)
	}
	return nil
}

func (a *App) OpenNote(noteId string) (string, error) {

	defer log.PrintTrace(log.Func("OpenNote()"))

	var w strings.Builder

	err := a.current.ReadNote(&w, noteId)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("OpenNote() error\n%+v", err)
	}
	return w.String(), nil
}

func (a *App) SaveNote(noteId string, data string) error {

	defer log.PrintTrace(log.Func("SaveNote()"))

	err := a.current.SaveNote(noteId, []byte(data))
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("ReadNote() error\n%+v", err)
	}

	return nil
}
