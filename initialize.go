package binder

import (
	"binder/api/json"
	"binder/db/model"
	"binder/fs"
	"binder/setup"

	"golang.org/x/xerrors"
)

func (b *Binder) Initialize(name string) error {

	if b == nil {
		return EmptyError
	}

	m, err := setup.LoadInstallManifest()
	if err != nil {
		return xerrors.Errorf("LoadInstallManifest() error: %w", err)
	}

	err = b.initializeTemplate(m)
	if err != nil {
		return xerrors.Errorf("initializeTemplate() error: %w", err)
	}
	//データベースをコミット
	err = b.fileSystem.CommitAll(fs.M("Initialize", "Templates"))
	if err != nil {
		return xerrors.Errorf("CommitAll(templates) error: %w", err)
	}

	err = b.initializeNote(m)
	if err != nil {
		return xerrors.Errorf("initializeNote() error: %w", err)
	}
	//データベースをコミット
	err = b.fileSystem.CommitAll(fs.M("Initialize", "Notes"))
	if err != nil {
		return xerrors.Errorf("CommitAll(notes) error: %w", err)
	}

	err = b.initializeDiagram(m)
	if err != nil {
		return xerrors.Errorf("initializeDiagram() error: %w", err)
	}

	err = b.initializeAsset(m)
	if err != nil {
		return xerrors.Errorf("initializeAsset() error: %w", err)
	}

	if name == "" {
		return nil
	}

	//名称のデータをコピー

	return nil
}

func (b *Binder) initializeNote(m *setup.InstallManifest) error {
	for _, n := range m.Notes {
		jn := &json.Note{
			Id:              n.Id,
			Alias:           n.Alias,
			Name:            n.Name,
			ParentId:        n.ParentId,
			LayoutTemplate:  n.LayoutTemplate,
			ContentTemplate: n.ContentTemplate,
		}

		if n.Id != "" {
			// 固定IDのノート（ルートノートなど）はEditNoteが使えないため直接作成
			_, err := b.createNote(jn)
			if err != nil {
				return xerrors.Errorf("createNote(%s) error: %w", n.Id, err)
			}

			var rootStruct model.Structure
			rootStruct.Id = n.Id
			rootStruct.ParentId = n.ParentId
			rootStruct.Seq = 1
			rootStruct.Typ = "note"
			rootStruct.Name = n.Name
			rootStruct.Alias = n.Alias
			err = b.db.InsertStructure(&rootStruct, b.op)
			if err != nil {
				return xerrors.Errorf("InsertStructure(%s) error: %w", n.Id, err)
			}

			data, err := m.ReadFile(n.File)
			if err != nil {
				return xerrors.Errorf("ReadFile(%s) error: %w", n.File, err)
			}
			if len(data) > 0 {
				err = b.fileSystem.WriteNoteText(n.Id, data)
				if err != nil {
					return xerrors.Errorf("WriteNoteText(%s) error: %w", n.Id, err)
				}
			}
		} else {
			// 通常ノートはEditNoteで作成（内部でコミットあり）
			result, err := b.EditNote(jn, "")
			if err != nil {
				return xerrors.Errorf("EditNote(%s) error: %w", n.Name, err)
			}

			data, err := m.ReadFile(n.File)
			if err != nil {
				return xerrors.Errorf("ReadFile(%s) error: %w", n.File, err)
			}
			if len(data) > 0 {
				err = b.SaveNote(result.Id, data)
				if err != nil {
					return xerrors.Errorf("SaveNote(%s) error: %w", n.Name, err)
				}
				err = b.fileSystem.Commit(fs.M("Initialize Note", n.Name), fs.NoteFile(result.Id))
				if err != nil {
					return xerrors.Errorf("Commit(note %s) error: %w", n.Name, err)
				}
			}
		}
	}
	return nil
}

func (b *Binder) initializeDiagram(m *setup.InstallManifest) error {
	for _, d := range m.Diagrams {
		jd := &json.Diagram{
			ParentId: d.ParentId,
			Name:     d.Name,
		}
		result, err := b.EditDiagram(jd)
		if err != nil {
			return xerrors.Errorf("EditDiagram(%s) error: %w", d.Name, err)
		}

		data, err := m.ReadFile(d.File)
		if err != nil {
			return xerrors.Errorf("ReadFile(%s) error: %w", d.File, err)
		}
		if len(data) > 0 {
			err = b.SaveDiagram(result.Id, data)
			if err != nil {
				return xerrors.Errorf("SaveDiagram(%s) error: %w", d.Name, err)
			}
			err = b.fileSystem.Commit(fs.M("Initialize Diagram", d.Name), fs.DiagramFile(result.Id))
			if err != nil {
				return xerrors.Errorf("Commit(diagram %s) error: %w", d.Name, err)
			}
		}
	}
	return nil
}

func (b *Binder) initializeAsset(m *setup.InstallManifest) error {
	for _, a := range m.Assets {
		ja := &json.Asset{
			ParentId: a.ParentId,
			Name:     a.Name,
			Alias:    a.Alias,
		}
		data, err := m.ReadFile(a.File)
		if err != nil {
			return xerrors.Errorf("ReadFile(%s) error: %w", a.File, err)
		}
		_, err = b.editAsset(ja, data)
		if err != nil {
			return xerrors.Errorf("editAsset(%s) error: %w", a.Name, err)
		}
	}
	return nil
}

func (b *Binder) initializeTemplate(m *setup.InstallManifest) error {
	// HTMLテンプレート（layout/content）のみ初期化する。
	// snippet（note/diagram/template型）は0.3.3でtemplatesテーブルから分離済み。
	for _, t := range m.Templates {
		jt := &json.Template{
			Id:   t.Id,
			Typ:  t.Type,
			Name: t.Name,
		}
		_, err := b.createTemplate(jt)
		if err != nil {
			return xerrors.Errorf("createTemplate(%s) error: %w", t.Id, err)
		}

		data, err := m.ReadFile(t.File)
		if err != nil {
			return xerrors.Errorf("ReadFile(%s) error: %w", t.File, err)
		}
		if len(data) > 0 {
			_, err = b.fileSystem.WriteTemplate(jt, data)
			if err != nil {
				return xerrors.Errorf("WriteTemplate(%s) error: %w", t.Id, err)
			}
		}
	}
	return nil
}
