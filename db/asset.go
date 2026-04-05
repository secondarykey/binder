package db

import (
	"fmt"

	"binder/api/json"
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

func (inst *Instance) FindInAssetId(ids ...interface{}) ([]*model.Asset, error) {
	return inst.findAsset("id in ("+csvQ(ids)+")", "updated_date desc", -1, -1, ids...)
}

func (inst *Instance) FindAssetWithParent() ([]*json.Asset, error) {

	assets, err := inst.findAsset("", "created_date", -1, -1)
	if err != nil {
		return nil, xerrors.Errorf("inst.findAsset() error: %w", err)
	}

	// Structure経由でparentId取得
	ids := make([]interface{}, len(assets))
	for i, a := range assets {
		ids[i] = a.Id
	}

	rtn := make([]*json.Asset, len(assets))
	if len(ids) == 0 {
		return rtn, nil
	}

	structures, err := inst.FindInStructureId(ids...)
	if err != nil {
		return nil, xerrors.Errorf("inst.FindInStructureId() error: %w", err)
	}

	structMap := make(map[string]*model.Structure, len(structures))
	for _, s := range structures {
		structMap[s.Id] = s
	}

	parentIds := make([]interface{}, 0)
	parentMap := make(map[string][]*json.Asset)

	for idx, a := range assets {
		rtn[idx] = a.To()
		s, ok := structMap[a.Id]
		if ok {
			rtn[idx].ApplyStructure(s.To())
			pId := s.ParentId
			_, exists := parentMap[pId]
			if !exists {
				parentIds = append(parentIds, pId)
			}
			parentMap[pId] = append(parentMap[pId], rtn[idx])
		}
	}

	if len(parentIds) == 0 {
		return rtn, nil
	}

	notes, err := inst.FindInNoteId(parentIds...)
	if err != nil {
		return nil, xerrors.Errorf("inst.FindInNoteId() error: %w", err)
	}

	// 親NoteのStructure情報も取得
	noteIds := make([]interface{}, len(notes))
	for i, n := range notes {
		noteIds[i] = n.Id
	}
	noteStructs, err := inst.FindInStructureId(noteIds...)
	if err != nil {
		return nil, xerrors.Errorf("inst.FindInStructureId(notes) error: %w", err)
	}
	noteStructMap := make(map[string]*model.Structure, len(noteStructs))
	for _, s := range noteStructs {
		noteStructMap[s.Id] = s
	}

	for _, note := range notes {
		children, ok := parentMap[note.Id]
		if !ok {
			return nil, fmt.Errorf("parent note is not exist")
		}
		jn := note.To()
		if ns, ok := noteStructMap[note.Id]; ok {
			jn.ApplyStructure(ns.To())
		}
		for _, a := range children {
			a.Parent = jn
		}
	}
	return rtn, nil
}


func (inst *Instance) GetAssetWithParent(id string) (*json.Asset, error) {

	a, err := inst.GetAsset(id)
	if err != nil {
		return nil, xerrors.Errorf("GetAsset() error: %w", err)
	}

	// Structure経由でparentId取得
	s, err := inst.GetStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("GetStructure() error: %w", err)
	}

	ja := a.To()
	ja.ApplyStructure(s.To())

	n, err := inst.GetNote(s.ParentId)
	if err != nil {
		return nil, xerrors.Errorf("GetNote() error: %w", err)
	}

	// 親NoteのStructure情報も取得
	ns, err := inst.GetStructure(s.ParentId)
	if err != nil {
		return nil, xerrors.Errorf("GetStructure(parent) error: %w", err)
	}

	jn := n.To()
	jn.ApplyStructure(ns.To())

	ja.SetParent(jn)

	return ja, nil
}
