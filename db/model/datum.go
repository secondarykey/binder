package model

import "time"

type Datum struct {
	ID       string
	NoteId   string
	Name     string
	Detail   string
	PluginId string

	Publish time.Time
	Created time.Time
	Updated time.Time

	// not schema
	Note *Note `json:"-"`
}

func (d *Datum) SetParent(n *Note) {
	d.Note = n
	n.addDatum(d)
}
