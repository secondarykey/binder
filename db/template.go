package db

import (
	"binder/api/json"
	"binder/db/model"
)

func (inst *Instance) FindLayoutTemplates() ([]*model.Template, error) {
	return inst.findTypeTemplates(json.LayoutTemplateType)
}

func (inst *Instance) FindContentTemplates() ([]*model.Template, error) {
	return inst.findTypeTemplates(json.ContentTemplateType)
}

func (inst *Instance) findTypeTemplates(t json.TemplateType) ([]*model.Template, error) {
	return inst.findTemplate("type = ?", "updated_date desc", -1, -1, string(t))
}

func (inst *Instance) FindTemplates() ([]*model.Template, error) {
	return inst.findTemplate("", "updated_date desc", -1, -1)
}

func (inst *Instance) FindInTemplateId(ids ...interface{}) ([]*model.Template, error) {
	return inst.findTemplate("id in ("+csvQ(ids)+")", "updated_date desc", -1, -1, ids...)
}
