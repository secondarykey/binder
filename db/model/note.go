package model

import (
	"binder/api/json"
	"fmt"
	"time"
)

type Note struct {
	Id              string `db:"id:key"`
	LayoutTemplate  string `db:"layout_template"`
	ContentTemplate string `db:"content_template"`

	Created     time.Time `db:"created_date:insert"`
	CreatedUser string    `db:"created_user:insert"`
	Updated     time.Time `db:"updated_date"`
	UpdatedUser string    `db:"updated_user"`
}

func (n *Note) String() string {
	return fmt.Sprintf("%s", n.Id)
}

func (n *Note) To() *json.Note {
	var rtn json.Note
	rtn.Id = n.Id
	rtn.LayoutTemplate = n.LayoutTemplate
	rtn.ContentTemplate = n.ContentTemplate
	rtn.Created = n.Created
	rtn.CreatedUser = n.CreatedUser
	rtn.Updated = n.Updated
	rtn.UpdatedUser = n.UpdatedUser
	return &rtn
}

func ConvertNote(a *json.Note) *Note {
	var rtn Note
	rtn.Id = a.Id
	rtn.LayoutTemplate = a.LayoutTemplate
	rtn.ContentTemplate = a.ContentTemplate
	rtn.Created = a.Created
	rtn.CreatedUser = a.CreatedUser
	rtn.Updated = a.Updated
	rtn.UpdatedUser = a.UpdatedUser
	return &rtn
}
