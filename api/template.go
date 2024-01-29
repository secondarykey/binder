package api

import (
	"fmt"
)

func (a *App) OpenTemplate(id string) (string, error) {

	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}

	data, err := a.current.OpenTemplate(id)
	if err != nil {
		return "", fmt.Errorf("ReadTemplate() error\n%+v", err)
	}
	return string(data), nil
}

func (a *App) SaveTemplate(id string, data string) error {

	if a.current == nil {
		return fmt.Errorf("Not Open Binder")
	}

	err := a.current.SaveTemplate(id, []byte(data))
	if err != nil {
		return fmt.Errorf("Savetemplate() error\n%+v", err)
	}

	return nil
}

func (a *App) CreateTemplateHTML(id string, temp string, elm string) (string, error) {
	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}

	html, err := a.current.CreateTemplateHTML(id, temp, elm)
	if err != nil {
		return "", fmt.Errorf("CreateNoteHTML() error\n%+v", err)
	}
	return html, nil
}
