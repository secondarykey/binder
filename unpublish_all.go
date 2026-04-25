package binder

import (
	"binder/fs"
	"errors"

	"golang.org/x/xerrors"
)

// UnpublishAll は公開済みの全エンティティ（ノート・ダイアグラム・アセット・レイヤー）を
// 一括で未公開状態にし、1つのコミットにまとめる。
func (b *Binder) UnpublishAll() error {

	if b == nil {
		return EmptyError
	}

	var allFiles []string

	// --- Notes ---
	notes, err := b.db.FindNotes()
	if err != nil {
		return xerrors.Errorf("db.FindNotes() error: %w", err)
	}
	if len(notes) > 0 {
		ids := make([]interface{}, len(notes))
		for i, n := range notes {
			ids[i] = n.Id
		}
		structs, err := b.getStructureMap(ids...)
		if err != nil {
			return xerrors.Errorf("getStructureMap(notes) error: %w", err)
		}
		for _, n := range notes {
			s, ok := structs[n.Id]
			if !ok {
				continue
			}
			m := n.To()
			m.ApplyStructure(s.To())
			if m.Republish.IsZero() {
				continue
			}
			if err := b.db.UnpublishStructure(n.Id, b.op); err != nil {
				return xerrors.Errorf("db.UnpublishStructure(note %s) error: %w", n.Id, err)
			}
			fn, err := b.fileSystem.UnpublishNote(m)
			if err != nil {
				return xerrors.Errorf("fs.UnpublishNote(%s) error: %w", n.Id, err)
			}
			allFiles = append(allFiles, fn)
			if mf, ok := b.fileSystem.UnpublishNoteMeta(m); ok {
				allFiles = append(allFiles, mf)
			}
		}
	}

	// --- Diagrams ---
	diagrams, err := b.db.FindDiagrams()
	if err != nil {
		return xerrors.Errorf("db.FindDiagrams() error: %w", err)
	}
	if len(diagrams) > 0 {
		ids := make([]interface{}, len(diagrams))
		for i, d := range diagrams {
			ids[i] = d.Id
		}
		structs, err := b.getStructureMap(ids...)
		if err != nil {
			return xerrors.Errorf("getStructureMap(diagrams) error: %w", err)
		}
		for _, d := range diagrams {
			s, ok := structs[d.Id]
			if !ok {
				continue
			}
			m := d.To()
			m.ApplyStructure(s.To())
			if m.Republish.IsZero() {
				continue
			}
			if err := b.db.UnpublishStructure(d.Id, b.op); err != nil {
				return xerrors.Errorf("db.UnpublishStructure(diagram %s) error: %w", d.Id, err)
			}
			fn, err := b.fileSystem.UnpublishDiagram(m)
			if err != nil {
				return xerrors.Errorf("fs.UnpublishDiagram(%s) error: %w", d.Id, err)
			}
			allFiles = append(allFiles, fn)
		}
	}

	// --- Assets ---
	assets, err := b.db.FindAssetWithParent()
	if err != nil {
		return xerrors.Errorf("db.FindAssetWithParent() error: %w", err)
	}
	for _, a := range assets {
		if a.Republish.IsZero() {
			continue
		}
		if err := b.db.UnpublishStructure(a.Id, b.op); err != nil {
			return xerrors.Errorf("db.UnpublishStructure(asset %s) error: %w", a.Id, err)
		}
		fn, err := b.fileSystem.UnpublishAsset(a)
		if err != nil {
			return xerrors.Errorf("fs.UnpublishAsset(%s) error: %w", a.Id, err)
		}
		allFiles = append(allFiles, fn)
	}

	// --- Layers ---
	layers, err := b.db.FindLayers()
	if err != nil {
		return xerrors.Errorf("db.FindLayers() error: %w", err)
	}
	if len(layers) > 0 {
		ids := make([]interface{}, len(layers))
		for i, l := range layers {
			ids[i] = l.Id
		}
		structs, err := b.getStructureMap(ids...)
		if err != nil {
			return xerrors.Errorf("getStructureMap(layers) error: %w", err)
		}
		for _, l := range layers {
			s, ok := structs[l.Id]
			if !ok {
				continue
			}
			m := l.To()
			m.ApplyStructure(s.To())
			if m.Republish.IsZero() {
				continue
			}
			if err := b.db.UnpublishStructure(l.Id, b.op); err != nil {
				return xerrors.Errorf("db.UnpublishStructure(layer %s) error: %w", l.Id, err)
			}
			fn, err := b.fileSystem.UnpublishLayer(m)
			if err != nil {
				return xerrors.Errorf("fs.UnpublishLayer(%s) error: %w", l.Id, err)
			}
			allFiles = append(allFiles, fn)
		}
	}

	if len(allFiles) == 0 {
		return nil
	}

	allFiles = append(allFiles, fs.StructureTableFile())

	if err := b.fileSystem.Commit(fs.M("Unpublish All"), allFiles...); err != nil && !errors.Is(err, fs.UpdatedFilesError) {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}
