package db

import (
	"fmt"
	"time"

	"binder/db/model"

	_ "github.com/mithrandie/csvq-driver"
	"golang.org/x/xerrors"
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

func (inst *Instance) PublishDiagram(id string, op Op) error {
	now := time.Now()
	num, err := inst.updateDiagram(
		"publish_date = ?,updated_date = ?,updated_user = ?",
		"id = ?",
		now, now, op.GetOperationId(), id)
	if err != nil {
		return xerrors.Errorf("updateDiagram() error: %w", err)
	}
	if num != 1 {
		return fmt.Errorf("updateDiagram() non single error: %v == %d", id, num)
	}
	return nil
}
