package model

import (
	"binder/api/json"
	"fmt"
	"time"
)

type Structure struct {
	Id       string `db:"id:key"`
	ParentId string `db:"parent_id"`
	Seq      int    `db:"seq"`
	Typ      string `db:"type"`
	Name     string `db:"name"`
	Detail   string `db:"detail"`
	Alias     string    `db:"alias"`
	Publish   time.Time `db:"publish_date"`
	Republish time.Time `db:"republish_date"`
	Private   bool      `db:"private"`
	Created   time.Time `db:"created_date:insert"`
	CreatedUser string    `db:"created_user:insert"`
	Updated     time.Time `db:"updated_date"`
	UpdatedUser string    `db:"updated_user"`
}

func (s *Structure) String() string {
	return fmt.Sprintf("%s,%s,%s,%s", s.Id, s.ParentId, s.Typ, s.Name)
}

func (s *Structure) To() *json.Structure {
	var rtn json.Structure
	rtn.Id = s.Id
	rtn.ParentId = s.ParentId
	rtn.Seq = s.Seq
	rtn.Typ = s.Typ
	rtn.Name = s.Name
	rtn.Detail = s.Detail
	rtn.Alias = s.Alias
	rtn.Publish = s.Publish
	rtn.Republish = s.Republish
	rtn.Private = s.Private
	rtn.Created = s.Created
	rtn.CreatedUser = s.CreatedUser
	rtn.Updated = s.Updated
	rtn.UpdatedUser = s.UpdatedUser
	return &rtn
}

func ConvertStructure(s *json.Structure) *Structure {
	var rtn Structure
	rtn.Id = s.Id
	rtn.ParentId = s.ParentId
	rtn.Seq = s.Seq
	rtn.Typ = s.Typ
	rtn.Name = s.Name
	rtn.Detail = s.Detail
	rtn.Alias = s.Alias
	rtn.Publish = s.Publish
	rtn.Republish = s.Republish
	rtn.Private = s.Private
	rtn.Created = s.Created
	rtn.CreatedUser = s.CreatedUser
	rtn.Updated = s.Updated
	rtn.UpdatedUser = s.UpdatedUser
	return &rtn
}
