package db

import (
	"fmt"
	"time"

	"binder/db/model"

	_ "github.com/mithrandie/csvq-driver"
	"golang.org/x/xerrors"
)

func (inst *Instance) ExistAsset(id string) bool {
	return inst.existAsset(id)
}

func (inst *Instance) FindAssets() ([]*model.Asset, error) {
	return inst.findAsset("", "created_date", -1, -1)
}

func (inst *Instance) FindAssetWithParent() ([]*model.Asset, error) {
	assets, err := inst.findAsset("", "created_date", -1, -1)
	if err != nil {
		return nil, xerrors.Errorf("inst.findAsset() error: %w", err)
	}
	ids := make([]interface{}, 0, len(assets))
	parentMap := make(map[string][]*model.Asset)

	for _, a := range assets {
		pId := a.ParentId
		_, ok := parentMap[pId]
		if !ok {
			ids = append(ids, pId)
		}
		parentMap[pId] = append(parentMap[pId], a)

	}

	if len(ids) == 0 {
		return assets, nil
	}

	notes, err := inst.FindInNoteId(ids...)
	if err != nil {
		return nil, xerrors.Errorf("inst.findAsset() error: %w", err)
	}

	for _, note := range notes {
		assets, ok := parentMap[note.Id]
		if !ok {
			return nil, fmt.Errorf("parent note is not exist")
		}
		for _, a := range assets {
			a.Parent = note
		}
	}
	return assets, nil
}

func (inst *Instance) PublishAsset(id string, op Op) error {
	now := time.Now()
	num, err := inst.updateAsset(
		"publish_date = ?,updated_date = ?,updated_user = ?",
		"id = ?",
		now, now, op.GetOperationId(), id)
	if err != nil {
		return xerrors.Errorf("updateAsset() error: %w", err)
	}
	if num != 1 {
		return fmt.Errorf("updateAsset() non single error: %v == %d", id, num)
	}
	return nil
}

func (inst *Instance) GetAssetWithParent(id string) (*model.Asset, error) {

	a, err := inst.GetAsset(id)
	if err != nil {
		return nil, xerrors.Errorf("GetAsset() error: %w", err)
	}

	n, err := inst.GetNote(a.ParentId)
	if err != nil {
		return nil, xerrors.Errorf("GetNote() error: %w", err)
	}
	a.SetParent(n)
	return a, nil
}
