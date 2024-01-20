package api

import (
	"binder"

	"fmt"
)

func (a *App) OpenTemplate(id string) (string, error) {

	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}

	data, err := a.current.ReadTemplate(id)
	if err != nil {
		return "", fmt.Errorf("ReadTemplate() error\n%+v", err)
	}
	return string(data), nil
}

func (a *App) SaveTemplate(id string, data string) error {

	if a.current == nil {
		return fmt.Errorf("Not Open Binder")
	}

	//枠を作成
	txt := a.current.AddTemplateFrame(id, data)
	err := a.current.WriteTemplate(id, []byte(txt))
	if err != nil {
		return fmt.Errorf("WriteTemplate() error\n%+v", err)
	}
	return nil
}

func (a *App) CreateTemplateHTML(id string, temp string, elm string) (string, error) {

	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}

	html, err := binder.CreateTemplateHTML(a.current, id, temp, elm)
	if err != nil {
		return "", fmt.Errorf("CreateNoteHTML() error\n%+v", err)
	}
	return html, nil
}
