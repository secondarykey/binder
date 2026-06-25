package api

import (
	"binder/api/json"
	"binder/log"
	"strings"
)

func (a *App) EditTemplate(t *json.Template) (*json.Template, error) {

	defer log.PrintTrace(log.Func("EditTemplate()"))

	tmp, err := a.current.EditTemplate(t)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return tmp, nil
}

func (a *App) RemoveTemplate(id string) error {

	defer log.PrintTrace(log.Func("RemoveTemplate()"))

	_, err := a.current.RemoveTemplate(id)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) GetTemplate(id string) (*json.Template, error) {

	defer log.PrintTrace(log.Func("GetTemplate()"))

	t, err := a.current.GetTemplate(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return t, nil
}

func (a *App) OpenTemplate(id string) (string, error) {

	defer log.PrintTrace(log.Func("OpenTemplate()"))

	var w strings.Builder
	err := a.current.ReadTemplate(&w, id)
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}
	return w.String(), nil
}

func (a *App) SaveTemplate(id string, data string) error {

	defer log.PrintTrace(log.Func("SaveTemplate()"))

	err := a.current.SaveTemplate(id, []byte(data))
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}

	return nil
}

func (a *App) UpdateTemplateSeqs(ids []string) error {

	defer log.PrintTrace(log.Func("UpdateTemplateSeqs()"))

	err := a.current.UpdateTemplateSeqs(ids)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) GetPublishedNotesByTemplate(templateId string) ([]*json.Leaf, error) {

	defer log.PrintTrace(log.Func("GetPublishedNotesByTemplate()"))

	leaves, err := a.current.GetPublishedNotesByTemplate(templateId)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return leaves, nil
}

func (a *App) GetHTMLTemplates() (*json.Templates, error) {

	defer log.PrintTrace(log.Func("GetHTMLTemplates()"))

	l, c, d, err := a.current.GetHTMLTemplates()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}

	var tmpls json.Templates
	tmpls.Layouts = l
	tmpls.Contents = c
	tmpls.Diagrams = d

	return &tmpls, nil
}
