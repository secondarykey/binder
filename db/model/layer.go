package model

import (
	"binder/entity"
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

func (l *Layer) To() *entity.Layer {
	var rtn entity.Layer
	rtn.Id = l.Id
	rtn.Created = l.Created
	rtn.CreatedUser = l.CreatedUser
	rtn.Updated = l.Updated
	rtn.UpdatedUser = l.UpdatedUser
	return &rtn
}

func ConvertLayer(l *entity.Layer) *Layer {
	var rtn Layer
	rtn.Id = l.Id
	rtn.Created = l.Created
	rtn.CreatedUser = l.CreatedUser
	rtn.Updated = l.Updated
	rtn.UpdatedUser = l.UpdatedUser
	return &rtn
}
