package model

import (
	"binder/api/json"
	"fmt"
	"time"
)

type Config struct {
	Name   string `db:"name"`
	Detail string `db:"detail"`
	Remote string `db:"remote"`

	MarkedURL  string `db:"marked_url"`
	MermaidURL string `db:"mermaid_url"`

	Created     time.Time `db:"created_date:insert"`
	CreatedUser string    `db:"created_user:insert"`
	Updated     time.Time `db:"updated_date"`
	UpdatedUser string    `db:"updated_user"`
}

func (c *Config) String() string {
	return fmt.Sprintf("%s,%s", c.Name, c.Remote)
}

func (c *Config) To() *json.Config {
	var rtn json.Config
	rtn.Name = c.Name
	rtn.Detail = c.Detail
	rtn.Remote = c.Remote
	rtn.MarkedURL = c.MarkedURL
	rtn.MermaidURL = c.MermaidURL
	rtn.Created = c.Created
	rtn.CreatedUser = c.CreatedUser
	rtn.Updated = c.Updated
	rtn.UpdatedUser = c.UpdatedUser
	return &rtn
}

func ConvertConfig(c *json.Config) *Config {
	var rtn Config
	rtn.Name = c.Name
	rtn.Detail = c.Detail
	rtn.Remote = c.Remote
	rtn.MarkedURL = c.MarkedURL
	rtn.MermaidURL = c.MermaidURL
	rtn.Created = c.Created
	rtn.CreatedUser = c.CreatedUser
	rtn.Updated = c.Updated
	rtn.UpdatedUser = c.UpdatedUser
	return &rtn
}
