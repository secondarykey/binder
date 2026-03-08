package api

import (
	"binder/api/json"
	"binder/log"
	"fmt"
	"strings"
)

func (a *App) EditTemplate(t *json.Template) (*json.Template, error) {

	defer log.PrintTrace(log.Func("EditTemplate()"))

	tmp, err := a.current.EditTemplate(t)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("binder.EditTemplate() error\n%+v", err)
	}
	return tmp, nil
}

func (a *App) GetTemplate(id string) (*json.Template, error) {

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

func (a *App) UpdateTemplateSeqs(ids []string) error {

	defer log.PrintTrace(log.Func("UpdateTemplateSeqs()"))

	err := a.current.UpdateTemplateSeqs(ids)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("UpdateTemplateSeqs() error\n%+v", err)
	}
	return nil
}

func (a *App) GetHTMLTemplates() (*json.Templates, error) {

	defer log.PrintTrace(log.Func("GetHTMLTemplates()"))

	l, c, err := a.current.GetHTMLTemplates()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("CreateTemplateHTML() error\n%+v", err)
	}

	var tmpls json.Templates
	tmpls.Layouts = l
	tmpls.Contents = c

	return &tmpls, nil
}
