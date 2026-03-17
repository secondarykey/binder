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
	num, err := inst.updateStructure(
		"publish_date = ?,updated_date = ?,updated_user = ?",
		"id = ?",
		now, now, op.GetOperationId(), id)
	if err != nil {
		return xerrors.Errorf("updateStructure() error: %w", err)
	}
	if num != 1 {
		return fmt.Errorf("updateStructure() non single error: %v == %d", id, num)
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
	// publish_date は structures テーブルで管理されるため、先に公開済み note の ID を取得する
	structs, err := inst.findStructure(
		fmt.Sprintf("type = 'note' and !(publish_date = '%s')", TimeZero),
		"publish_date desc", limit, 0)
	if err != nil {
		return nil, xerrors.Errorf("findStructure() error: %w", err)
	}
	if len(structs) == 0 {
		return nil, nil
	}
	ids := make([]interface{}, len(structs))
	for i, s := range structs {
		ids[i] = s.Id
	}
	return inst.FindInNoteId(ids...)
}

func (inst *Instance) FindInNoteId(ids ...interface{}) ([]*model.Note, error) {
	return inst.findNote("id in ("+csvQ(ids)+")", "updated_date desc", -1, -1, ids...)
}

// FindNotesByTemplate はlayout_templateまたはcontent_templateに指定IDを持つノートを返す。
// テンプレート削除前の参照チェックに使用する。
func (inst *Instance) FindNotesByTemplate(templateId string) ([]*model.Note, error) {
	return inst.findNote("layout_template = ? OR content_template = ?", "", -1, -1, templateId, templateId)
}
