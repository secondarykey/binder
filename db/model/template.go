package model

import (
	"fmt"
	"time"
)

type Template struct {
	Id     string `db:"id:key" json:"id"`
	Typ    string `db:"type" json:"type"`
	Name   string `db:"name" json:"name"`
	Detail string `db:"detail" json:"detail"`

	Created     time.Time `db:"created_date:insert" json:"created"`
	CreatedUser string    `db:"created_user:insert" json:"createdUser"`
	Updated     time.Time `db:"updated_date" json:"updated"`
	UpdatedUser string    `db:"updated_user" json:"updatedUser"`

	UpdatedStatus Status `db:"-" json:"updatedStatus"`
}

func (t *Template) String() string {
	return fmt.Sprintf("%s,%s,%s", t.Id, t.Name, t.Typ)
}

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
