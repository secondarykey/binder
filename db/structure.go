package db

import (
	"fmt"
	"time"

	"binder/db/model"

	"golang.org/x/xerrors"
)

func (inst *Instance) FindStructures() ([]*model.Structure, error) {
	return inst.findStructure("", "parent_id,seq", -1, -1)
}

func (inst *Instance) FindStructuresByParent(parentId string) ([]*model.Structure, error) {
	return inst.findStructure("parent_id = ?", "seq", -1, -1, parentId)
}

func (inst *Instance) FindInStructureId(ids ...interface{}) ([]*model.Structure, error) {
	return inst.findStructure("id in ("+csvQ(ids)+")", "parent_id,seq", -1, -1, ids...)
}

func (inst *Instance) GetMaxSeq(parentId string) (int, error) {
	structures, err := inst.findStructure("parent_id = ?", "seq desc", 1, 0, parentId)
	if err != nil {
		return 0, xerrors.Errorf("findStructure() error: %w", err)
	}
	if len(structures) == 0 {
		return 0, nil
	}
	return structures[0].Seq, nil
}

// PublishStructure は republish_date と updated_date を同一タイムスタンプで更新する。
// UpdateStructure() は内部で updated_date を time.Now() で上書きするため、
// republish_date と updated_date がずれる問題を防ぐため直接 updateStructure を呼ぶ。
// 初回公開時は publish_date も同時に設定する。
func (inst *Instance) PublishStructure(id string, op Op) (*model.Structure, error) {
	s, err := inst.GetStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("GetStructure() error: %w", err)
	}
	now := time.Now()
	var num int64
	if s.Publish.IsZero() {
		num, err = inst.updateStructure(
			"publish_date = ?,republish_date = ?,updated_date = ?,updated_user = ?",
			"id = ?", now, now, now, op.GetOperationId(), id)
		s.Publish = now
	} else {
		num, err = inst.updateStructure(
			"republish_date = ?,updated_date = ?,updated_user = ?",
			"id = ?", now, now, op.GetOperationId(), id)
	}
	if err != nil {
		return nil, xerrors.Errorf("updateStructure() error: %w", err)
	}
	if num != 1 {
		return nil, fmt.Errorf("updateStructure() non single error: %v == %d", id, num)
	}
	s.Republish = now
	s.Updated = now
	s.UpdatedUser = op.GetOperationId()
	return s, nil
}

// UnpublishStructure は republish_date をゼロにリセットして非公開扱いにする。
func (inst *Instance) UnpublishStructure(id string, op Op) error {
	now := time.Now()
	num, err := inst.updateStructure(
		"republish_date = ?,updated_date = ?,updated_user = ?",
		"id = ?", time.Time{}, now, op.GetOperationId(), id)
	if err != nil {
		return xerrors.Errorf("updateStructure() error: %w", err)
	}
	if num != 1 {
		return fmt.Errorf("updateStructure() non single error: %v == %d", id, num)
	}
	return nil
}
