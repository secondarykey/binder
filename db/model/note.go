package model

import "time"

type Note struct {
	ID      string
	Title   string
	Detail  string
	Publish time.Time
	Created time.Time
	Updated time.Time

	//non schema
	Data []*Datum
}

func (n *Note) addDatum(d *Datum) {
	n.Data = append(n.Data, d)
}
