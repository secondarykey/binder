package db

type TemplateType string

const (
	Layout   TemplateType = "layout"
	Content  TemplateType = "content"
	Diagram  TemplateType = "diagram"
	Note     TemplateType = "note"
	Template TemplateType = "template"
)

func (inst *Instance) GetLayoutTemplates() ([]*Template, error) {
	return inst.findTypeTemplates(Layout)
}

func (inst *Instance) GetContentTemplates() ([]*Template, error) {
	return inst.findTypeTemplates(Content)
}

func (inst *Instance) findTypeTemplates(t TemplateType) ([]*Template, error) {
	return inst.findTemplate("type = ?", "update_date desc", -1, -1, t)
}
