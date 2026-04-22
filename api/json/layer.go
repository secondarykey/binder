package json

import "time"

type Layer struct {
	Id       string `json:"id"`
	ParentId string `json:"parentId"`
	Alias    string `json:"alias"`
	Name     string `json:"name"`
	Detail   string `json:"detail"`

	Private bool `json:"private"`

	Publish          time.Time `json:"publish"`
	Republish        time.Time `json:"republish"`
	StructureUpdated time.Time `json:"structureUpdated"`
	Created          time.Time `json:"created"`
	CreatedUser      string    `json:"createdUser"`
	Updated          time.Time `json:"updated"`
	UpdatedUser      string    `json:"updatedUser"`

	// not schema
	Parent        *Asset `json:"-"`
	PublishStatus Status `json:"publishStatus"`
	UpdatedStatus Status `json:"updatedStatus"`
}

func (l *Layer) ApplyStructure(s *Structure) {
	l.ParentId = s.ParentId
	l.Name = s.Name
	l.Detail = s.Detail
	l.Alias = s.Alias
	l.Private = s.Private
	l.Publish = s.Publish
	l.Republish = s.Republish
	l.StructureUpdated = s.Updated
}
