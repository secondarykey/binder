package api

import (
	"binder/db/model"
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

func (a *App) CreateTemplateHTML(id string, data string, elm string) (string, error) {

	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}

	temp, err := a.current.GetTemplate(id)
	if err != nil {
		return "", fmt.Errorf("GetTemplate() error: %w", err)
	}

	//TODO ノートを指定
	var note model.Note

	html, err := a.current.CreateTemplateHTML(temp, &note, data, elm)
	if err != nil {
		return "", fmt.Errorf("CreateTemplateHTML() error\n%+v", err)
	}
	return html, nil
}

type Templates struct {
	Layouts  []*model.Template `json:"layouts"`
	Contents []*model.Template `json:"contents"`
}

func (a *App) GetHTMLTemplates() (*Templates, error) {

	l, c, err := a.current.GetHTMLTemplates()
	if err != nil {
		return nil, fmt.Errorf("CreateTemplateHTML() error\n%+v", err)
	}

	var tmpls Templates
	tmpls.Layouts = l
	tmpls.Contents = c
	return &tmpls, nil
}
