package json

import "time"

type Note struct {
	Id              string `json:"id"`
	ParentId        string `json:"parentId"`
	Alias           string `json:"alias"`
	Name            string `json:"name"`
	Detail          string `json:"detail"`
	LayoutTemplate  string `json:"layoutTemplate"`
	ContentTemplate string `json:"contentTemplate"`

	Publish     time.Time `json:"publish"`
	Republish   time.Time `json:"republish"`
	Created     time.Time `json:"created"`
	CreatedUser string    `json:"createdUser"`
	Updated     time.Time `json:"updated"`
	UpdatedUser string    `json:"updatedUser"`

	Parent   *Note      `json:"-"`
	Children []*Note    `json:"-"`
	Diagrams []*Diagram `json:"-"`
	Assets   []*Asset   `json:"-"`

	PublishStatus Status `json:"publishStatus"`
	UpdatedStatus Status `json:"updatedStatus"`

	Layouts  []*Template `json:"layouts"`
	Contents []*Template `json:"contents"`
}

func (n *Note) AddDiagram(d *Diagram) {
	n.Diagrams = append(n.Diagrams, d)
	d.Parent = n
}

func (n *Note) AddChild(c *Note) {
	n.Children = append(n.Children, c)
	c.Parent = n
}

func (n *Note) AddAsset(a *Asset) {
	n.Assets = append(n.Assets, a)
	a.Parent = n
}

func (n *Note) SetTemplates(l, c []*Template) {
	n.Layouts = l
	n.Contents = c
}

func (n *Note) ApplyStructure(s *Structure) {
	n.ParentId = s.ParentId
	n.Name = s.Name
	n.Detail = s.Detail
	n.Alias = s.Alias
	n.Publish = s.Publish
	n.Republish = s.Republish
}
