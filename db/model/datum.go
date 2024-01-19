package model

import "time"

type Datum struct {
	ID       string `json:"id"`
	NoteId   string `json:"noteId"`
	Name     string `json:"name"`
	Detail   string `json:"detail"`
	PluginId string `json:"pluginId"`

	Publish time.Time `json:"publish"`
	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`

	// not schema
	Note *Note `json:"-"`
}

func (d *Datum) SetParent(n *Note) {
	d.Note = n
	n.addDatum(d)
}
