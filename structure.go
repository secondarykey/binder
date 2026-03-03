package binder

import (
	"binder/db/model"
	"binder/fs"

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

// MoveNode はノードの親と並び順を更新する。
// parentId が空文字の場合はルート配置。childIds はその親配下の全ノードIDを順序通りに指定する。
func (b *Binder) MoveNode(parentId string, childIds []string) error {

	if b == nil {
		return EmptyError
	}

	for i, id := range childIds {
		s, err := b.db.GetStructure(id)
		if err != nil {
			return xerrors.Errorf("db.GetStructure(%s) error: %w", id, err)
		}
		s.ParentId = parentId
		s.Seq = i + 1
		err = b.db.UpdateStructure(s, b.op)
		if err != nil {
			return xerrors.Errorf("db.UpdateStructure(%s) error: %w", id, err)
		}
	}

	err := b.fileSystem.Commit(fs.M("Move", "node"), fs.StructureTableFile())
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
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
