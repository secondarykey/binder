package json

import "time"

type Config struct {
	Name   string `json:"name"`
	Detail string `json:"detail"`
	Remote string `json:"remote"`

	MarkedURL  string `json:"markedUrl"`
	MermaidURL string `json:"mermaidUrl"`

	Created     time.Time `json:"created"`
	CreatedUser string    `json:"createdUser"`
	Updated     time.Time `json:"updated"`
	UpdatedUser string    `json:"updatedUser"`
}
