package model

import "time"

type Config struct {
	Name       string `json:"name"`
	Detail     string `json:"detail"`
	ListNum    int    `json:"listNum"`
	Branch     string `json:"branch"`
	AutoCommit int    `json:"autoCommit"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}
