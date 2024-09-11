package model

import "time"

type Asset struct {
	Id       string `db:"id:key" json:"id"`
	ParentId string `db:"parent_id" json:"noteId"`
	Name     string `db:"name" json:"name"`
	Detail   string `db:"detail" json:"detail"`

	Created     time.Time `db:"created_date:insert" json:"created"`
	CreatedUser string    `db:"created_user:insert" json:"createdUser"`
	Updated     time.Time `db:"updated_date" json:"updated"`
	UpdatedUser string    `db:"updated_user" json:"updatedUser"`

	// not schema
	Parent *Note `db:"-" json:"-"`
}

func (a *Asset) SetParent(n *Note) {
	a.Parent = n
	n.addAsset(a)
}
