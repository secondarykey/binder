package db

import "binder/db/model"

func (inst *Instance) FindLayoutTemplates() ([]*model.Template, error) {
	return inst.findTypeTemplates(model.LayoutTemplateType)
}

func (inst *Instance) FindContentTemplates() ([]*model.Template, error) {
	return inst.findTypeTemplates(model.ContentTemplateType)
}

func (inst *Instance) findTypeTemplates(t model.TemplateType) ([]*model.Template, error) {
	return inst.findTemplate("type = ?", "updated_date desc", -1, -1, string(t))
}

func (inst *Instance) FindTemplates() ([]*model.Template, error) {
	return inst.findTemplate("", "updated_date desc", -1, -1)
}
