package db

import (
	"binder/db/model"

	_ "github.com/mithrandie/csvq-driver"
)

func (inst *Instance) ExistDiagram(id string) bool {
	d, err := inst.GetDiagram(id)
	if d != nil && err == nil {
		return true
	}
	return false
}

func (inst *Instance) FindDiagrams() ([]*model.Diagram, error) {
	return inst.findDiagram("", "updated_date desc", -1, -1)
}

func (inst *Instance) FindInDiagramId(ids ...interface{}) ([]*model.Diagram, error) {
	return inst.findDiagram("id in ("+csvQ(ids)+")", "updated_date desc", -1, -1, ids...)
}
