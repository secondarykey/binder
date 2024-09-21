package api

import (
	"binder/db/model"
	"binder/log"
	"fmt"
)

func (a *App) Generate(noteId string, dataId string, elm string) error {

	defer log.PrintTrace(log.Func("Generate()"))

	err := a.current.Generate(noteId, dataId, elm)
	if err != nil {
		log.PrintStackTrace(err)
		return err
	}
	return nil
}

func (a *App) CreateNoteHTML(id string, elm string) (string, error) {

	defer log.PrintTrace(log.Func("CreateNoteHTML()"))

	n, err := a.current.GetNote(id)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("CreateNoteHTML() error\n%+v", err)
	}

	html, err := a.current.CreateNoteHTML(n, true, elm)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("CreateNoteHTML() error\n%+v", err)
	}
	return html, nil
}

func (a *App) ParseNote(id string, local bool, elm string) (string, error) {

	defer log.PrintTrace(log.Func("ParseNote()"))

	n, err := a.current.GetNote(id)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("CreateNoteHTML() error\n%+v", err)
	}

	html, err := a.current.ParseElement(n, local, elm)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("ParseElement() error\n%+v", err)
	}
	return html, nil
}

func (a *App) CreateTemplateHTML(id string, data string, elm string) (string, error) {

	defer log.PrintTrace(log.Func("CreateTemplateHTML()"))

	temp, err := a.current.GetTemplate(id)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("GetTemplate() error: %w", err)
	}

	//TODO ノートを指定
	var note model.Note
	html, err := a.current.CreateTemplateHTML(temp, &note, data, elm)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("CreateTemplateHTML() error\n%+v", err)
	}
	return html, nil
}
