package json

import "time"

type Structure struct {
	Id          string    `json:"id"`
	ParentId    string    `json:"parentId"`
	Seq         int       `json:"seq"`
	Typ         string    `json:"type"`
	Name        string    `json:"name"`
	Detail      string    `json:"detail"`
	Alias       string    `json:"alias"`
	Publish     time.Time `json:"publish"`
	Republish   time.Time `json:"republish"`
	Created     time.Time `json:"created"`
	CreatedUser string    `json:"createdUser"`
	Updated     time.Time `json:"updated"`
	UpdatedUser string    `json:"updatedUser"`
}
