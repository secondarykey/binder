package api

import (
	"binder/api/json"
	"binder/log"
	"fmt"
)

func (a *App) CreateNoteHTML(id string, elm string) (string, error) {

	defer log.PrintTrace(log.Func("CreateNoteHTML()"))

	n, err := a.current.GetNote(id)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("CreateNoteHTML() error\n%+v", err)
	}

	html, err := a.current.CreateNoteHTML(n, false, elm)
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

	html, err := a.current.ParseNote(n, local, elm)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("ParseNote() error\n%+v", err)
	}
	return html, nil
}

func (a *App) ParseDiagram(id string, local bool, elm string) (string, error) {

	defer log.PrintTrace(log.Func("ParseDiagram()"))

	d, err := a.current.GetDiagram(id)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("ParseDiagram() error\n%+v", err)
	}

	result, err := a.current.ParseDiagram(d, local, elm)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("ParseDiagram() error\n%+v", err)
	}
	return result, nil
}

func (a *App) CreateTemplateHTML(id string, typ json.TemplateType, oId string, noteId string, elm string) (string, error) {

	defer log.PrintTrace(log.Func("CreateTemplateHTML()"))

	n, err := a.current.GetNote(noteId)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("GetNote() error\n%+v", err)
	}

	html, err := a.current.CreateTemplateHTML(id, typ, oId, n, elm)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("CreateTemplateHTML() error\n%+v", err)
	}
	return html, nil
}
