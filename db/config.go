package db

import "binder/db/model"

func (inst *Instance) insertDefaultConfig() error {
	op := createSystemOperation()
	var con model.Config
	con.Name = "Binder"
	con.Detail = ""
	con.Remote = "origin"
	con.MarkedURL = "origin"
	con.MermaidURL = "origin"
	return inst.InsertConfig(&con, op)
}
