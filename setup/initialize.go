package setup

import (
	"binder/api/json"
	"binder/db"
	"binder/db/model"
	"binder/fs"
	"binder/log"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
)

// initialize はマニフェストからサンプルデータ（テンプレート・ノート・ダイアグラム・アセット）を作成する。
// db.Instance と fs.FileSystem を直接操作するため、Binder に依存しない。
func initialize(f *fs.FileSystem, inst *db.Instance, name string) error {

	m, err := loadInstallManifest()
	if err != nil {
		return xerrors.Errorf("loadInstallManifest() error: %w", err)
	}

	op := newOp("user")

	err = initializeTemplate(f, inst, op, m)
	if err != nil {
		return xerrors.Errorf("initializeTemplate() error: %w", err)
	}
	err = f.CommitAll(fs.M("Initialize", "Templates"))
	if err != nil {
		return xerrors.Errorf("CommitAll(templates) error: %w", err)
	}

	err = initializeNote(f, inst, op, m)
	if err != nil {
		return xerrors.Errorf("initializeNote() error: %w", err)
	}
	err = f.CommitAll(fs.M("Initialize", "Notes"))
	if err != nil {
		return xerrors.Errorf("CommitAll(notes) error: %w", err)
	}

	err = initializeDiagram(f, inst, op, m)
	if err != nil {
		return xerrors.Errorf("initializeDiagram() error: %w", err)
	}

	err = initializeAsset(f, inst, op, m)
	if err != nil {
		return xerrors.Errorf("initializeAsset() error: %w", err)
	}

	err = f.CommitAll(fs.M("Initialize", "Diagrams/Assets"))
	if err != nil {
		return xerrors.Errorf("CommitAll(diagrams/assets) error: %w", err)
	}

	return nil
}

// setupOp は db.Op インターフェースの実装
type setupOp struct {
	id string
}

func (op setupOp) GetOperationId() string {
	return op.id
}

func newOp(userId string) db.Op {
	return setupOp{id: userId}
}

func generateId() string {
	id, err := uuid.NewV7()
	if err != nil {
		log.ErrorE("UUID v7 generate error ", err)
		return ""
	}
	return id.String()
}

// createStructure はStructureレコードを作成する。
func createStructure(inst *db.Instance, op db.Op, id, parentId, typ, name, detail, alias string) error {
	maxSeq, err := inst.GetMaxSeq(parentId)
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

	err = inst.InsertStructure(&s, op)
	if err != nil {
		return xerrors.Errorf("db.InsertStructure() error: %w", err)
	}
	return nil
}

func initializeTemplate(f *fs.FileSystem, inst *db.Instance, op db.Op, m *installManifest) error {
	for _, t := range m.Templates {
		jt := &json.Template{
			Id:   t.Id,
			Typ:  t.Type,
			Name: t.Name,
		}

		// テンプレートファイルを作成
		_, err := f.CreateTemplateFile(jt)
		if err != nil {
			return xerrors.Errorf("fs.CreateTemplateFile(%s) error: %w", t.Id, err)
		}

		// DBに挿入
		mt := model.ConvertTemplate(jt)
		err = inst.InsertTemplate(mt, op)
		if err != nil {
			return xerrors.Errorf("db.InsertTemplate(%s) error: %w", t.Id, err)
		}

		// テンプレートファイルの内容を書き込み
		data, err := m.readFile(t.File)
		if err != nil {
			return xerrors.Errorf("ReadFile(%s) error: %w", t.File, err)
		}
		if len(data) > 0 {
			_, err = f.WriteTemplate(jt, data)
			if err != nil {
				return xerrors.Errorf("fs.WriteTemplate(%s) error: %w", t.Id, err)
			}
		}
	}
	return nil
}

func initializeNote(f *fs.FileSystem, inst *db.Instance, op db.Op, m *installManifest) error {
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
			// 固定IDのノート（ルートノートなど）
			_, err := f.CreateNoteFile(jn)
			if err != nil {
				return xerrors.Errorf("fs.CreateNoteFile(%s) error: %w", n.Id, err)
			}

			mn := model.ConvertNote(jn)
			err = inst.InsertNote(mn, op)
			if err != nil {
				return xerrors.Errorf("db.InsertNote(%s) error: %w", n.Id, err)
			}

			// 固定IDなのでStructureも直接作成
			var rootStruct model.Structure
			rootStruct.Id = n.Id
			rootStruct.ParentId = n.ParentId
			rootStruct.Seq = 1
			rootStruct.Typ = "note"
			rootStruct.Name = n.Name
			rootStruct.Alias = n.Alias
			err = inst.InsertStructure(&rootStruct, op)
			if err != nil {
				return xerrors.Errorf("db.InsertStructure(%s) error: %w", n.Id, err)
			}

			data, err := m.readFile(n.File)
			if err != nil {
				return xerrors.Errorf("ReadFile(%s) error: %w", n.File, err)
			}
			if len(data) > 0 {
				err = f.WriteNoteText(n.Id, data)
				if err != nil {
					return xerrors.Errorf("fs.WriteNoteText(%s) error: %w", n.Id, err)
				}
			}
		} else {
			// 通常ノート — IDを生成して作成
			jn.Id = generateId()
			jn.Alias = jn.Id

			_, err := f.CreateNoteFile(jn)
			if err != nil {
				return xerrors.Errorf("fs.CreateNoteFile(%s) error: %w", jn.Id, err)
			}

			mn := model.ConvertNote(jn)
			err = inst.InsertNote(mn, op)
			if err != nil {
				return xerrors.Errorf("db.InsertNote(%s) error: %w", jn.Id, err)
			}

			err = createStructure(inst, op, jn.Id, jn.ParentId, "note", jn.Name, "", jn.Alias)
			if err != nil {
				return xerrors.Errorf("createStructure(%s) error: %w", jn.Id, err)
			}

			data, err := m.readFile(n.File)
			if err != nil {
				return xerrors.Errorf("ReadFile(%s) error: %w", n.File, err)
			}
			if len(data) > 0 {
				err = f.WriteNoteText(jn.Id, data)
				if err != nil {
					return xerrors.Errorf("fs.WriteNoteText(%s) error: %w", jn.Id, err)
				}
			}
		}
	}
	return nil
}

func initializeDiagram(f *fs.FileSystem, inst *db.Instance, op db.Op, m *installManifest) error {
	for _, d := range m.Diagrams {
		jd := &json.Diagram{
			ParentId:      d.ParentId,
			Name:          d.Name,
			StyleTemplate: d.StyleTemplate,
		}

		// IDを生成
		jd.Id = generateId()
		jd.Alias = jd.Id

		fn, err := f.CreateDiagramFile(jd)
		if err != nil {
			return xerrors.Errorf("fs.CreateDiagramFile(%s) error: %w", d.Name, err)
		}

		md := model.ConvertDiagram(jd)
		err = inst.InsertDiagram(md, op)
		if err != nil {
			return xerrors.Errorf("db.InsertDiagram(%s) error: %w", d.Name, err)
		}

		err = createStructure(inst, op, jd.Id, jd.ParentId, "diagram", jd.Name, "", jd.Alias)
		if err != nil {
			return xerrors.Errorf("createStructure(%s) error: %w", d.Name, err)
		}

		// ダイアグラムファイルの内容を書き込み
		data, err := m.readFile(d.File)
		if err != nil {
			return xerrors.Errorf("ReadFile(%s) error: %w", d.File, err)
		}
		if len(data) > 0 {
			err = f.WriteDiagram(jd.Id, data)
			if err != nil {
				return xerrors.Errorf("fs.WriteDiagram(%s) error: %w", d.Name, err)
			}
		}

		// ファイル変更をコミット
		files := []string{fn, fs.DiagramTableFile(), fs.StructureTableFile()}
		err = f.Commit(fs.M("Initialize Diagram", d.Name), files...)
		if err != nil {
			return xerrors.Errorf("Commit(diagram %s) error: %w", d.Name, err)
		}
	}
	return nil
}

func initializeAsset(f *fs.FileSystem, inst *db.Instance, op db.Op, m *installManifest) error {
	for _, a := range m.Assets {
		ja := &json.Asset{
			ParentId: a.ParentId,
			Name:     a.Name,
			Alias:    a.Alias,
		}

		// IDを生成
		ja.Id = generateId()

		ma := model.ConvertAsset(ja)
		err := inst.InsertAsset(ma, op)
		if err != nil {
			return xerrors.Errorf("db.InsertAsset(%s) error: %w", a.Name, err)
		}

		err = createStructure(inst, op, ja.Id, ja.ParentId, "asset", ja.Name, "", ja.Alias)
		if err != nil {
			return xerrors.Errorf("createStructure(%s) error: %w", a.Name, err)
		}

		// アセットファイルの書き込み
		data, err := m.readFile(a.File)
		if err != nil {
			return xerrors.Errorf("ReadFile(%s) error: %w", a.File, err)
		}

		var files []string
		if data != nil {
			fn, err := f.CreateAsset(ja, data)
			if err != nil {
				return xerrors.Errorf("fs.CreateAsset(%s) error: %w", a.Name, err)
			}
			files = append(files, fn)
		}

		files = append(files, fs.AssetTableFile(), fs.StructureTableFile())
		err = f.Commit(fs.M("Initialize Asset", a.Name), files...)
		if err != nil {
			return xerrors.Errorf("Commit(asset %s) error: %w", a.Name, err)
		}
	}
	return nil
}
