package json

import "time"

type Template struct {
	Id     string `json:"id"`
	Typ    string `json:"type"`
	Name   string `json:"name"`
	Detail string `json:"detail"`
	Seq    int    `json:"seq"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`

	UpdatedStatus Status `json:"updatedStatus"`
}

type Templates struct {
	Layouts  []*Template `json:"layouts"`
	Contents []*Template `json:"contents"`
}

type TemplateType string

const (
	LayoutTemplateType  TemplateType = "layout"
	ContentTemplateType TemplateType = "content"
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
