package model

import (
	"binder/api/json"
	"fmt"
	"time"
)

type Asset struct {
	Id     string `db:"id:key"`
	Binary bool   `db:"binary"`
	Mime   string `db:"mime"`

	Created     time.Time `db:"created_date:insert"`
	CreatedUser string    `db:"created_user:insert"`
	Updated     time.Time `db:"updated_date"`
	UpdatedUser string    `db:"updated_user"`
}

func (a *Asset) String() string {
	return fmt.Sprintf("%s", a.Id)
}

func (a *Asset) To() *json.Asset {
	var rtn json.Asset
	rtn.Id = a.Id
	rtn.Binary = a.Binary
	rtn.Mime = a.Mime
	rtn.Created = a.Created
	rtn.CreatedUser = a.CreatedUser
	rtn.Updated = a.Updated
	rtn.UpdatedUser = a.UpdatedUser
	return &rtn
}

func ConvertAsset(a *json.Asset) *Asset {
	var rtn Asset
	rtn.Id = a.Id
	rtn.Binary = a.Binary
	rtn.Mime = a.Mime
	rtn.Created = a.Created
	rtn.CreatedUser = a.CreatedUser
	rtn.Updated = a.Updated
	rtn.UpdatedUser = a.UpdatedUser
	return &rtn
}
