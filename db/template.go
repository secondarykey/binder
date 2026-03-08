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
	return inst.findTemplate("type = ?", "seq asc, updated_date desc", -1, -1, string(t))
}

// FindDefaultContentTemplate はseqが最小のcontentテンプレートを返す。
// ノート新規作成時のデフォルトテンプレート選択に使用する。
func (inst *Instance) FindDefaultContentTemplate() (*model.Template, error) {
	results, err := inst.findTemplate("type = ?", "seq asc", 1, 0, string(json.ContentTemplateType))
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, nil
	}
	return results[0], nil
}

func (inst *Instance) FindTemplates() ([]*model.Template, error) {
	return inst.findTemplate("", "seq asc, updated_date desc", -1, -1)
}

func (inst *Instance) FindInTemplateId(ids ...interface{}) ([]*model.Template, error) {
	return inst.findTemplate("id in ("+csvQ(ids)+")", "seq asc, updated_date desc", -1, -1, ids...)
}
