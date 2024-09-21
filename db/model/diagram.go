package model

import (
	"fmt"
	"time"
)

type Diagram struct {
	Id       string `db:"id:key" json:"id"`
	ParentId string `db:"parent_id" json:"parentId"`
	Alias    string `db:"alias" json:"alias"`
	Name     string `db:"name" json:"name"`
	Detail   string `db:"detail" json:"detail"`

	Publish     time.Time `db:"publish_date" json:"publish"`
	Created     time.Time `db:"created_date:insert" json:"created"`
	CreatedUser string    `db:"created_user:insert" json:"createdUser"`
	Updated     time.Time `db:"updated_date" json:"updated"`
	UpdatedUser string    `db:"updated_user" json:"updatedUser"`

	// not schema
	Parent *Note `db:"-" json:"-"`
}

func (d *Diagram) String() string {
	return fmt.Sprintf("%s,%s,%s", d.Id, d.ParentId, d.Name)
}

func (d *Diagram) SetParent(n *Note) {
	d.Parent = n
	n.addDiagram(d)
}
