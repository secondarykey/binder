package model

import (
	"binder/api/json"
	"fmt"
	"time"
)

type Template struct {
	Id     string `db:"id:key"`
	Typ    string `db:"type"`
	Name   string `db:"name"`
	Detail string `db:"detail"`

	Created     time.Time `db:"created_date:insert"`
	CreatedUser string    `db:"created_user:insert"`
	Updated     time.Time `db:"updated_date"`
	UpdatedUser string    `db:"updated_user"`
}

func (t *Template) String() string {
	return fmt.Sprintf("%s,%s,%s", t.Id, t.Name, t.Typ)
}

func (t *Template) To() *json.Template {
	var rtn json.Template
	rtn.Id = t.Id
	rtn.Typ = t.Typ
	rtn.Name = t.Name
	rtn.Detail = t.Detail
	rtn.Created = t.Created
	rtn.Updated = t.Updated
	return &rtn
}

func ConvertTemplate(a *json.Template) *Template {
	var rtn Template
	rtn.Id = a.Id
	rtn.Typ = a.Typ
	rtn.Name = a.Name
	rtn.Detail = a.Detail
	rtn.Created = a.Created
	rtn.Updated = a.Updated
	return &rtn
}
