package model

import (
	"fmt"
	"time"
)

type Asset struct {
	Id       string `db:"id:key" json:"id"`
	ParentId string `db:"parent_id" json:"parentId"`
	Alias    string `db:"alias" json:"alias"`
	Name     string `db:"name" json:"name"`
	Detail   string `db:"detail" json:"detail"`

	Binary bool `db:"binary" json:"binary"`

	Created     time.Time `db:"created_date:insert" json:"created"`
	CreatedUser string    `db:"created_user:insert" json:"createdUser"`
	Updated     time.Time `db:"updated_date" json:"updated"`
	UpdatedUser string    `db:"updated_user" json:"updatedUser"`

	// not schema
	Parent        *Note  `db:"-" json:"note"`
	PublishStatus Status `db:"-" json:"publishStatus"`
	UpdatedStatus Status `db:"-" json:"updatedStatus"`
}

func (a *Asset) SetParent(n *Note) {
	a.Parent = n
	if n != nil {
		n.addAsset(a)
	}
}

func (a *Asset) String() string {
	return fmt.Sprintf("%s,%s,%s", a.Id, a.ParentId, a.Name)
}
