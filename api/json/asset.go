package json

import "time"

type Asset struct {
	Id       string `json:"id"`
	ParentId string `json:"parentId"`
	Alias    string `json:"alias"`
	Name     string `json:"name"`
	Detail   string `json:"detail"`

	Binary  bool   `json:"binary"`
	Mime    string `json:"mime"`
	Private bool   `json:"private"`

	Publish          time.Time `json:"publish"`
	Republish        time.Time `json:"republish"`
	StructureUpdated time.Time `json:"structureUpdated"`
	Created          time.Time `json:"created"`
	CreatedUser      string    `json:"createdUser"`
	Updated          time.Time `json:"updated"`
	UpdatedUser      string    `json:"updatedUser"`

	Parent        *Note  `json:"-"`
	PublishStatus Status `json:"publishStatus"`
	UpdatedStatus Status `json:"updatedStatus"`
}

func (a *Asset) SetParent(n *Note) {
	a.Parent = n
	if n != nil {
		n.AddAsset(a)
	}
}

func (a *Asset) ApplyStructure(s *Structure) {
	a.ParentId = s.ParentId
	a.Name = s.Name
	a.Detail = s.Detail
	a.Alias = s.Alias
	a.Private = s.Private
	a.Publish = s.Publish
	a.Republish = s.Republish
	a.StructureUpdated = s.Updated
}
