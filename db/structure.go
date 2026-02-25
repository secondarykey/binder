package db

import (
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
