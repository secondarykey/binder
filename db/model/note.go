package model

import "time"

type Note struct {
	Id              string `db:"id:key" json:"id"`
	ParentId        string `db:"parent_id" json:"parentId"`
	Name            string `db:"name" json:"name"`
	Detail          string `db:"detail" json:"detail"`
	LayoutTemplate  string `db:"layout_template" json:"layoutTemplate"`
	ContentTemplate string `db:"content_template" json:"contentTemplate"`

	Publish     time.Time `db:"publish_date" json:"publish"`
	Created     time.Time `db:"created_date:insert" json:"created"`
	CreatedUser string    `db:"created_user:insert" json:"createdUser"`
	Updated     time.Time `db:"updated_date" json:"updated"`
	UpdatedUser string    `db:"updated_user" json:"updatedUser"`

	//non schema
	Parent   *Note      `db:"-" json:"-"`
	Children []*Note    `db:"-" json:"children"`
	Diagrams []*Diagram `db:"-" json:"diagrams"`
	Assets   []*Asset   `db:"-" json:"assets"`
}

func (n *Note) addDiagram(d *Diagram) {
	n.Diagrams = append(n.Diagrams, d)
	d.Parent = n
}

func (n *Note) addChild(c *Note) {
	n.Children = append(n.Children, c)
	c.Parent = n
}

func (n *Note) addAsset(a *Asset) {
	n.Assets = append(n.Assets, a)
	a.Parent = n
}
