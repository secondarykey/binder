package model

import "time"

type Config struct {
	Name        string
	Description string
	Created     time.Time
	Updated     time.Time
}
