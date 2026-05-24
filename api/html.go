package api

import (
	"binder/api/json"
	"binder/log"
	"fmt"
)

func (a *App) CreateNoteHTML(id string, local bool, elm string) (*json.ParseResult, error) {

	defer log.PrintTrace(log.Func("CreateNoteHTML()"))

	n, err := a.current.GetNote(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("CreateNoteHTML() error\n%+v", err)
	}

	html, warnings, err := a.current.CreateNoteHTML(n, local, elm)
	if err != nil {
		return &json.ParseResult{Error: err.Error(), Warnings: warnings}, nil
	}
	return &json.ParseResult{HTML: html, Warnings: warnings}, nil
}

func (a *App) ParseNote(id string, local bool, elm string) (*json.ParseResult, error) {

	defer log.PrintTrace(log.Func("ParseNote()"))

	n, err := a.current.GetNote(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("ParseNote() error\n%+v", err)
	}

	html, warnings, err := a.current.ParseNote(n, local, elm)
	if err != nil {
		return &json.ParseResult{Error: err.Error(), Warnings: warnings}, nil
	}
	return &json.ParseResult{HTML: html, Warnings: warnings}, nil
}

func (a *App) ParseAsset(id string, local bool, elm string) (*json.ParseResult, error) {

	defer log.PrintTrace(log.Func("ParseAsset()"))

	result, warnings, err := a.current.ParseAsset(local, elm)
	if err != nil {
		return &json.ParseResult{Error: err.Error(), Warnings: warnings}, nil
	}
	return &json.ParseResult{HTML: result, Warnings: warnings}, nil
}

func (a *App) ParseDiagram(id string, local bool, elm string) (*json.ParseResult, error) {

	defer log.PrintTrace(log.Func("ParseDiagram()"))

	d, err := a.current.GetDiagram(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("ParseDiagram() error\n%+v", err)
	}

	result, warnings, err := a.current.ParseDiagram(d, local, elm)
	if err != nil {
		return &json.ParseResult{Error: err.Error(), Warnings: warnings}, nil
	}
	return &json.ParseResult{HTML: result, Warnings: warnings}, nil
}

func (a *App) CreateTemplateHTML(id string, typ json.TemplateType, oId string, noteId string, elm string) (*json.ParseResult, error) {

	defer log.PrintTrace(log.Func("CreateTemplateHTML()"))

	n, err := a.current.GetNote(noteId)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetNote() error\n%+v", err)
	}

	html, warnings, err := a.current.CreateTemplateHTML(id, typ, oId, n, elm)
	if err != nil {
		return &json.ParseResult{Error: err.Error(), Warnings: warnings}, nil
	}
	return &json.ParseResult{HTML: html, Warnings: warnings}, nil
}
