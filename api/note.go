package api

import (
	"binder/db/model"
	"log/slog"

	"fmt"
)

func (a *App) EditNote(n *model.Note, imageName string) (*model.Note, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	slog.Info("EditNote()", slog.Any("Note", n), "image", imageName)
	//ノートを追加
	n, err := a.current.EditNote(n, imageName)
	if err != nil {
		slog.Error("EditNote()", "Error", err)
		return nil, fmt.Errorf("EditNote() error\n%+v", err)
	}
	return n, nil
}

func (a *App) RemoveNote(id string) error {

	if a.current == nil {
		return fmt.Errorf("Not Open Binder")
	}

	slog.Info("RemoveNote()", "Id", id)
	_, err := a.current.RemoveNote(id)
	if err != nil {
		return fmt.Errorf("RemoveNote() error\n%+v", err)
	}
	return nil
}

func (a *App) GetNote(id string) (*model.Note, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}
	n, err := a.current.GetNote(id)
	if err != nil {
		return nil, fmt.Errorf("GetNote() error\n%+v", err)
	}
	return n, nil
}

func (a *App) GetLatestNoteId() (string, error) {

	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}

	id, err := a.current.GetLatestNoteId()
	if err != nil {
		return "", fmt.Errorf("GetLatestNoteId() error\n%+v", err)
	}
	return id, nil
}

func (a *App) OpenNote(noteId string) (string, error) {

	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}

	data, err := a.current.OpenNote(noteId)
	if err != nil {
		return "", fmt.Errorf("OpenNote() error\n%+v", err)
	}
	return string(data), nil
}

func (a *App) SaveNote(noteId string, data string) error {

	if a.current == nil {
		return fmt.Errorf("Not Open Binder")
	}

	err := a.current.SaveNote(noteId, []byte(data))
	if err != nil {
		return fmt.Errorf("ReadNote() error\n%+v", err)
	}
	return nil
}

func (a *App) CreateNoteHTML(id string, elm string) (string, error) {

	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}

	html, err := a.current.CreateNoteHTML(id, true, elm)
	if err != nil {
		return "", fmt.Errorf("CreateNoteHTML() error\n%+v", err)
	}
	return html, nil
}

func (a *App) ParseNote(id string, local bool, elm string) (string, error) {

	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}

	html, err := a.current.ParseElement(id, local, elm)
	if err != nil {
		return "", fmt.Errorf("ParseElement() error\n%+v", err)
	}
	return html, nil
}
