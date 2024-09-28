package db

import "binder/db/model"

type TemplateType string

const (
	LayoutTemplateType   TemplateType = "html_layout"
	ContentTemplateType  TemplateType = "html_content"
	DiagramTemplateType  TemplateType = "diagram"
	NoteTemplateType     TemplateType = "note"
	TemplateTemplateType TemplateType = "template"
)

func (t TemplateType) IsHTML() bool {
	if t == LayoutTemplateType || t == ContentTemplateType {
		return true
	}
	return false
}
func (t TemplateType) IsContent() bool {
	if t == ContentTemplateType {
		return true
	}
	return false
}

func (inst *Instance) FindLayoutTemplates() ([]*model.Template, error) {
	return inst.findTypeTemplates(LayoutTemplateType)
}

func (inst *Instance) FindContentTemplates() ([]*model.Template, error) {
	return inst.findTypeTemplates(ContentTemplateType)
}

func (inst *Instance) findTypeTemplates(t TemplateType) ([]*model.Template, error) {
	return inst.findTemplate("type = ?", "updated_date desc", -1, -1, string(t))
}

func (inst *Instance) FindTemplates() ([]*model.Template, error) {
	return inst.findTemplate("", "updated_date desc", -1, -1)
}
