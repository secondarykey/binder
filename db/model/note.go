package model

import "time"

type Note struct {
	ID      string    `json:"id"`
	Name    string    `json:"name"`
	Detail  string    `json:"detail"`
	Publish time.Time `json:"publish"`
	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`

	//non schema
	Data []*Datum `json:"data"`
}

func (n *Note) addDatum(d *Datum) {
	n.Data = append(n.Data, d)
}
