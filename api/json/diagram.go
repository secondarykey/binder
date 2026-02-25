package json

import "time"

type Diagram struct {
	Id       string `json:"id"`
	ParentId string `json:"parentId"`
	Alias    string `json:"alias"`
	Name     string `json:"name"`
	Detail   string `json:"detail"`

	Publish     time.Time `json:"publish"`
	Created     time.Time `json:"created"`
	CreatedUser string    `json:"createdUser"`
	Updated     time.Time `json:"updated"`
	UpdatedUser string    `json:"updatedUser"`

	// not schema
	Parent        *Note  `json:"-"`
	PublishStatus Status `json:"publishStatus"`
	UpdatedStatus Status `json:"updatedStatus"`
}

func (d *Diagram) SetParent(n *Note) {
	d.Parent = n
	n.AddDiagram(d)
}

func (d *Diagram) ApplyStructure(s *Structure) {
	d.ParentId = s.ParentId
	d.Name = s.Name
	d.Detail = s.Detail
	d.Alias = s.Alias
}
