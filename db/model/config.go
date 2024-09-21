package model

import (
	"fmt"
	"time"
)

type Config struct {
	Name   string `db:"name" json:"name"`
	Detail string `db:"detail" json:"detail"`
	Remote string `db:"remote" json:"remote"`

	MarkedURL  string `db:"marked_url" json:"markedUrl"`
	MermaidURL string `db:"mermaid_url" json:"mermaidUrl"`

	Created     time.Time `db:"created_date:insert" json:"created"`
	CreatedUser string    `db:"created_user:insert" json:"createdUser"`
	Updated     time.Time `db:"updated_date" json:"updated"`
	UpdatedUser string    `db:"updated_user" json:"updatedUser"`
}

func (c *Config) String() string {
	return fmt.Sprintf("%s,%s", c.Name, c.Remote)
}
