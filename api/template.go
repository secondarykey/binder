package api

import (
	"binder/db/model"
	"binder/log"
	"fmt"
	"strings"
)

func (a *App) EditTemplate(t *model.Template) (*model.Template, error) {

	defer log.PrintTrace(log.Func("EditTemplate()"))

	tmp, err := a.current.EditTemplate(t)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("binder.EditTemplate() error\n%+v", err)
	}
	return tmp, nil
}

func (a *App) GetTemplate(id string) (*model.Template, error) {

	defer log.PrintTrace(log.Func("GetTemplate()"))

	t, err := a.current.GetTemplate(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetTemplate() error\n%+v", err)
	}
	return t, nil
}

func (a *App) OpenTemplate(id string) (string, error) {

	defer log.PrintTrace(log.Func("OpenTemplate()"))

	var w strings.Builder
	err := a.current.ReadTemplate(&w, id)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("ReadTemplate() error\n%+v", err)
	}
	return w.String(), nil
}

func (a *App) SaveTemplate(id string, data string) error {

	defer log.PrintTrace(log.Func("SaveTemplate()"))

	err := a.current.SaveTemplate(id, []byte(data))
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("Savetemplate() error\n%+v", err)
	}

	return nil
}

type Templates struct {
	Layouts  []*model.Template `json:"layouts"`
	Contents []*model.Template `json:"contents"`
}

func (a *App) GetHTMLTemplates() (*Templates, error) {

	defer log.PrintTrace(log.Func("GetHTMLTemplates()"))

	l, c, err := a.current.GetHTMLTemplates()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("CreateTemplateHTML() error\n%+v", err)
	}

	var tmpls Templates
	tmpls.Layouts = l
	tmpls.Contents = c
	return &tmpls, nil
}
