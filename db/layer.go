package db

import (
	"binder/db/model"

	_ "github.com/mithrandie/csvq-driver"
)

func (inst *Instance) ExistLayer(id string) bool {
	l, err := inst.GetLayer(id)
	if l != nil && err == nil {
		return true
	}
	return false
}

func (inst *Instance) FindLayers() ([]*model.Layer, error) {
	return inst.findLayer("", "updated_date desc", -1, -1)
}

func (inst *Instance) FindInLayerId(ids ...interface{}) ([]*model.Layer, error) {
	return inst.findLayer("id in ("+csvQ(ids)+")", "updated_date desc", -1, -1, ids...)
}
