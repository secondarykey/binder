package db

import (
	"fmt"
	"time"

	"binder/db/model"

	_ "github.com/mithrandie/csvq-driver"
	"golang.org/x/xerrors"
)

func (inst *Instance) ExistNote(id string) bool {
	n, err := inst.GetNote(id)
	if n != nil && err == nil {
		return true
	}
	return false
}

func (inst *Instance) PublishNote(id string, op Op) error {
	now := time.Now()
	num, err := inst.updateNote(
		"publish_date = ?,updated_date = ?,updated_user = ?",
		"id = ?",
		now, now, op.GetOperationId(), id)
	if err != nil {
		return xerrors.Errorf("updateNote() error: %w", err)
	}
	if err != nil {
		return fmt.Errorf("updateNote() non single error: %v == %d", id, num)
	}
	return nil
}

func (inst *Instance) FindNotes() ([]*model.Note, error) {
	return inst.findNote("", "updated_date desc", -1, -1)
}

func (inst *Instance) FindUpdatedNotes(limit int, offset int) ([]*model.Note, error) {
	return inst.findNote("", "updated_date desc", limit, offset)
}

func (inst *Instance) FindPublishNotes(limit int, offset int) ([]*model.Note, error) {
	return inst.findNote(fmt.Sprintf("!(publish_date = '%s')", TimeZero), "publish_date desc", limit, offset)
}

func (inst *Instance) FindInNoteId(ids ...interface{}) ([]*model.Note, error) {
	return inst.findNote("id in ("+csvQ(ids)+")", "", -1, -1, ids...)
}
