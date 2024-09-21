package api

import (
	"binder/db/model"
	"binder/log"
	"log/slog"

	"fmt"
)

func (a *App) EditNote(n *model.Note, imageName string) (*model.Note, error) {

	defer log.PrintTrace(log.Func("EditNote()"))

	slog.Info("EditNote()", slog.Any("Note", n), "image", imageName)
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

func (a *App) GetNote(id string) (*model.Note, error) {

	defer log.PrintTrace(log.Func("GetNote()"))

	n, err := a.current.GetNote(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetNote() error\n%+v", err)
	}
	return n, nil
}

func (a *App) OpenNote(noteId string) (string, error) {

	defer log.PrintTrace(log.Func("OpenNote()"))

	data, err := a.current.OpenNote(noteId)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("OpenNote() error\n%+v", err)
	}
	return string(data), nil
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
