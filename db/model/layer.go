package model

import (
	"binder/api/json"
	"fmt"
	"time"
)

type Layer struct {
	Id          string    `db:"id:key"`
	Created     time.Time `db:"created_date:insert"`
	CreatedUser string    `db:"created_user:insert"`
	Updated     time.Time `db:"updated_date"`
	UpdatedUser string    `db:"updated_user"`
}

func (l *Layer) String() string {
	return fmt.Sprintf("%s", l.Id)
}

func (l *Layer) To() *json.Layer {
	var rtn json.Layer
	rtn.Id = l.Id
	rtn.Created = l.Created
	rtn.CreatedUser = l.CreatedUser
	rtn.Updated = l.Updated
	rtn.UpdatedUser = l.UpdatedUser
	return &rtn
}

func ConvertLayer(l *json.Layer) *Layer {
	var rtn Layer
	rtn.Id = l.Id
	rtn.Created = l.Created
	rtn.CreatedUser = l.CreatedUser
	rtn.Updated = l.Updated
	rtn.UpdatedUser = l.UpdatedUser
	return &rtn
}
