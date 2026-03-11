package model

import (
	"binder/api/json"
	"fmt"
	"time"
)

type Diagram struct {
	Id          string    `db:"id:key"`
	Created     time.Time `db:"created_date:insert"`
	CreatedUser string    `db:"created_user:insert"`
	Updated     time.Time `db:"updated_date"`
	UpdatedUser string    `db:"updated_user"`
}

func (d *Diagram) String() string {
	return fmt.Sprintf("%s", d.Id)
}

func (d *Diagram) To() *json.Diagram {
	var rtn json.Diagram
	rtn.Id = d.Id
	rtn.Created = d.Created
	rtn.CreatedUser = d.CreatedUser
	rtn.Updated = d.Updated
	rtn.UpdatedUser = d.UpdatedUser
	return &rtn
}

func ConvertDiagram(d *json.Diagram) *Diagram {
	var rtn Diagram
	rtn.Id = d.Id
	rtn.Created = d.Created
	rtn.CreatedUser = d.CreatedUser
	rtn.Updated = d.Updated
	rtn.UpdatedUser = d.UpdatedUser
	return &rtn
}
