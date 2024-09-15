package model

import "time"

type Template struct {
	Id     string `db:"id:key" json:"id"`
	Typ    string `db:"type" json:"type"`
	Name   string `db:"name" json:"name"`
	Detail string `db:"detail" json:"detail"`

	Created     time.Time `db:"created_date:insert" json:"created"`
	CreatedUser string    `db:"created_user:insert" json:"createdUser"`
	Updated     time.Time `db:"updated_date" json:"updated"`
	UpdatedUser string    `db:"updated_user" json:"updatedUser"`
}
