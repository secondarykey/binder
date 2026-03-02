package json

import "fmt"

type Tree struct {
	Data []*Leaf `json:"data"`
}

type Leaf struct {
	Id       string  `json:"id"`
	ParentId string  `json:"parentId"`
	Seq      int     `json:"seq"`
	Name     string  `json:"name"`
	Type     string  `json:"type"`
	Children []*Leaf `json:"children"`
}

func NewLeaf(id, name string) *Leaf {
	var l Leaf
	l.Id = id
	l.Name = name
	return &l
}

func (l *Leaf) AddChild(c *Leaf) {
	l.Children = append(l.Children, c)
	c.ParentId = l.Id
}

func (l *Leaf) String() string {
	return fmt.Sprintf("%s(%s) %s", l.Name, l.Id, l.Type)
}
