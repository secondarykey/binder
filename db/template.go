package db

import "binder/db/model"

type TemplateType string

const (
	Layout   TemplateType = "layout"
	Content  TemplateType = "content"
	Diagram  TemplateType = "diagram"
	Note     TemplateType = "note"
	Template TemplateType = "template"
)

func (inst *Instance) FindLayoutTemplates() ([]*model.Template, error) {
	return inst.findTypeTemplates(Layout)
}

func (inst *Instance) FindContentTemplates() ([]*model.Template, error) {
	return inst.findTypeTemplates(Content)
}

func (inst *Instance) findTypeTemplates(t TemplateType) ([]*model.Template, error) {
	return inst.findTemplate("type = ?", "updated_date desc", -1, -1, string(t))
}
