package binder

import (
	"binder/api/json"
	. "binder/internal"

	"binder/db"
	"binder/db/model"
	"binder/fs"
	"binder/settings"
	"embed"
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

const (
	NoteRootId        = "index"
	TemplateLayoutId  = "layout"
	TemplateIndexId   = "index"
	TemplateContentId = "content"
)

//go:embed setup/_assets
var embFs embed.FS

// 渡されたパスをBinderに設定する
// ディレクトリが存在する場合は行えない
// サンプルとしていくつかデータを作成する
func Install(dir string, ver *Version) error {

	// ディレクトリが存在しない場合は作成する
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return xerrors.Errorf("os.MkdirAll() error: %w", err)
		}
	}

	err := checkDirectory(dir, true)
	if err != nil {
		return xerrors.Errorf("checkDirectory() error: %w", err)
	}

	//指定位置にGitを作成（デフォルトブランチ名で初期化）
	s := settings.Get()
	f, err := fs.NewWithBranch(dir, s.Git.Branch)
	if err != nil {
		return xerrors.Errorf("fs.NewWithBranch() error: %w", err)
	}

	return install(f, dir, ver)
}

func install(f *fs.FileSystem, dir string, ver *Version) error {

	//スキーマファイルを作成

	//空でもディレクトリは作っておく
	docsdir := filepath.Join(dir, f.GetPublic())
	err := os.MkdirAll(docsdir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(docs) error: %w", err)
	}

	datadir := filepath.Join(dir, fs.DiagramDir)
	err = os.MkdirAll(datadir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(diagrams) error: %w", err)
	}

	notesdir := filepath.Join(dir, fs.NoteDir)
	err = os.MkdirAll(notesdir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(notes) error: %w", err)
	}

	tempDir := filepath.Join(dir, fs.TemplateDir)
	err = os.MkdirAll(tempDir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(templates) error: %w", err)
	}

	assetdir := filepath.Join(dir, fs.AssetDir)
	err = os.MkdirAll(assetdir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(docs) error: %w", err)
	}

	//スキーマファイルをGitに追加

	//データベースを作成
	dbdir := filepath.Join(dir, fs.DBDir)
	err = os.MkdirAll(dbdir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir() error: %w", err)
	}

	err = db.Create(dbdir, ver)
	if err != nil {
		return xerrors.Errorf("db.Create() error: %w", err)
	}

	// binder.jsonをルートディレクトリに作成（0.4.5以降はname/detailも管理）
	if ver != nil {
		meta := &fs.BinderMeta{
			Version: ver.String(),
			Name:    "Binder",
		}
		err = fs.SaveMeta(dir, meta)
		if err != nil {
			return xerrors.Errorf("fs.SaveMeta() error: %w", err)
		}
	}

	//Gitへの追加を行う
	err = f.AddDBFiles()
	if err != nil {
		return xerrors.Errorf("Add() error: %w", err)
	}

	err = f.AddFile(fs.BinderMetaFile)
	if err != nil {
		return xerrors.Errorf("AddFile(binder.json) error: %w", err)
	}

	err = f.CommitAll(fs.M("Install", "Database"))
	if err != nil {
		return xerrors.Errorf("CommitAll() error: %w", err)
	}

	// デフォルトブランチ上でコミット済み。作業ブランチが設定されていれば切り替え
	s := settings.Get()
	if s.Git.WorkBranch != "" && s.Git.WorkBranch != s.Git.Branch {
		err = f.Branch(s.Git.WorkBranch)
		if err != nil {
			return xerrors.Errorf("fs.Branch(WorkBranch) error: %w", err)
		}
	}

	return nil
}

// install true 時すでに存在する場合、エラー
// install false 時存在しない場合エラー
func checkDirectory(dir string, install bool) error {

	//TODO ちょっと違うかも
	dirs := []string{"db", "docs", "templates", "diagrams", "notes"}

	for _, n := range dirs {
		target := filepath.Join(dir, n)
		_, err := os.Stat(target)
		if install && err == nil {
			return xerrors.Errorf("already exists[%s]", target)
		} else if !install && err != nil {
			return xerrors.Errorf("nothing [%s]", target)
		}
	}

	return nil
}

func (b *Binder) Initialize(name string) error {

	if b == nil {
		return EmptyError
	}

	m, err := loadInstallManifest()
	if err != nil {
		return xerrors.Errorf("loadInstallManifest() error: %w", err)
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

func (b *Binder) initializeNote(m *installManifest) error {
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

			data, err := m.readFile(n.File)
			if err != nil {
				return xerrors.Errorf("readFile(%s) error: %w", n.File, err)
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

			data, err := m.readFile(n.File)
			if err != nil {
				return xerrors.Errorf("readFile(%s) error: %w", n.File, err)
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

func (b *Binder) initializeDiagram(m *installManifest) error {
	for _, d := range m.Diagrams {
		jd := &json.Diagram{
			ParentId: d.ParentId,
			Name:     d.Name,
		}
		result, err := b.EditDiagram(jd)
		if err != nil {
			return xerrors.Errorf("EditDiagram(%s) error: %w", d.Name, err)
		}

		data, err := m.readFile(d.File)
		if err != nil {
			return xerrors.Errorf("readFile(%s) error: %w", d.File, err)
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

func (b *Binder) initializeAsset(m *installManifest) error {
	for _, a := range m.Assets {
		ja := &json.Asset{
			ParentId: a.ParentId,
			Name:     a.Name,
			Alias:    a.Alias,
		}
		data, err := m.readFile(a.File)
		if err != nil {
			return xerrors.Errorf("readFile(%s) error: %w", a.File, err)
		}
		_, err = b.editAsset(ja, data)
		if err != nil {
			return xerrors.Errorf("editAsset(%s) error: %w", a.Name, err)
		}
	}
	return nil
}

func (b *Binder) initializeTemplate(m *installManifest) error {
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

		data, err := m.readFile(t.File)
		if err != nil {
			return xerrors.Errorf("readFile(%s) error: %w", t.File, err)
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

func (b *Binder) copyTemplate(name string) error {

	if b == nil {
		return EmptyError
	}

	//var indexTmpl model.Template
	/*
		tempFs, err := stdFs.Sub(embFs, "_assets/templates/"+name)
		if err != nil {
			return xerrors.Errorf("template fs Sub() error: %w", err)
		}
	*/

	//TODO 作り方を考える
	//全テンプレートを設定
	for _, f := range []string{"layout", "index", "content"} {

		//TODO
		fmt.Println(f)

		//TODO FSで行う
		//data, err := stdFs.ReadFile(tempFs, f+".tmpl")
		//if err != nil {
		//return xerrors.Errorf("fs ReadFile() error: %w", err)
		//}

		//err = b.fileSystem.WriteTemplate(f, data)
		//if err != nil {
		//return xerrors.Errorf("WriteTemplate(%s) error: %w", f, err)
		//}
	}

	//ノート、テンプレート、ダイアグラムも処理を行う

	return nil
}
