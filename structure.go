package binder

import (
	"binder/db/model"

	"golang.org/x/xerrors"
)

// createStructure は新しいエンティティのStructure行を作成する
func (b *Binder) createStructure(id, parentId, typ, name, detail, alias string) error {

	maxSeq, err := b.db.GetMaxSeq(parentId)
	if err != nil {
		return xerrors.Errorf("db.GetMaxSeq() error: %w", err)
	}

	var s model.Structure
	s.Id = id
	s.ParentId = parentId
	s.Seq = maxSeq + 1
	s.Typ = typ
	s.Name = name
	s.Detail = detail
	s.Alias = alias

	err = b.db.InsertStructure(&s, b.op)
	if err != nil {
		return xerrors.Errorf("db.InsertStructure() error: %w", err)
	}
	return nil
}

// updateStructure は既存のStructure行を更新する
func (b *Binder) updateStructure(id, parentId, name, detail, alias string) error {

	s, err := b.db.GetStructure(id)
	if err != nil {
		return xerrors.Errorf("db.GetStructure() error: %w", err)
	}

	s.ParentId = parentId
	s.Name = name
	s.Detail = detail
	s.Alias = alias

	err = b.db.UpdateStructure(s, b.op)
	if err != nil {
		return xerrors.Errorf("db.UpdateStructure() error: %w", err)
	}
	return nil
}

// getStructureMap はIDのリストからStructureのマップを返す
func (b *Binder) getStructureMap(ids ...interface{}) (map[string]*model.Structure, error) {
	if len(ids) == 0 {
		return make(map[string]*model.Structure), nil
	}

	structures, err := b.db.FindInStructureId(ids...)
	if err != nil {
		return nil, xerrors.Errorf("db.FindInStructureId() error: %w", err)
	}

	m := make(map[string]*model.Structure, len(structures))
	for _, s := range structures {
		m[s.Id] = s
	}
	return m, nil
}
