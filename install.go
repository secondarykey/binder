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

//go:embed _assets
var embFs embed.FS

// 渡されたパスをBinderに設定する
// ディレクトリが存在する場合は行えない
// サンプルとしていくつかデータを作成する
func Install(dir string, ver *Version) error {

	err := checkDirectory(dir, true)
	if err != nil {
		return xerrors.Errorf("checkDirectory() error: %w", err)
	}

	//指定位置ににGitを作成
	f, err := fs.New(dir)
	if err != nil {
		return xerrors.Errorf("fs.New() error: %w", err)
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

	// binder.jsonをルートディレクトリに作成
	if ver != nil {
		meta := &BinderMeta{
			Version: ver.String(),
			Schema:  ver.String(),
		}
		err = saveMeta(dir, meta)
		if err != nil {
			return xerrors.Errorf("saveMeta() error: %w", err)
		}
	}

	//Gitへの追加を行う
	err = f.AddDBFiles()
	if err != nil {
		return xerrors.Errorf("Add() error: %w", err)
	}

	err = f.AddFile(BinderMetaFile)
	if err != nil {
		return xerrors.Errorf("AddFile(binder.json) error: %w", err)
	}

	err = f.CommitAll(fs.M("Install", "Database"))
	if err != nil {
		return xerrors.Errorf("CommitAll() error: %w", err)
	}

	s := settings.Get()
	err = f.Branch(s.Git.Branch)
	if err != nil {
		return xerrors.Errorf("fs.Branch() error: %w", err)
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

	//TODO テンプレートを作成
	err := b.initializeTemplate()
	if err != nil {
		return xerrors.Errorf("initializeTemplate() error: %w", err)
	}
	//データベースをコミット
	err = b.fileSystem.CommitAll(fs.M("Initialize", "Templates"))
	if err != nil {
		return xerrors.Errorf("CommitAll(templates) error: %w", err)
	}

	err = b.initializeNote()
	if err != nil {
		return xerrors.Errorf("initializeNote() error: %w", err)
	}
	//データベースをコミット
	err = b.fileSystem.CommitAll(fs.M("Initialize", "Notes"))
	if err != nil {
		return xerrors.Errorf("CommitAll(notes) error: %w", err)
	}

	err = b.initializeDiagram()
	if err != nil {
		return xerrors.Errorf("initializeNote() error: %w", err)
	}
	err = b.fileSystem.CommitAll(fs.M("Initialize", "Diagrams"))
	if err != nil {
		return xerrors.Errorf("CommitAll(diagrams) error: %w", err)
	}

	err = b.initializeAsset()
	if err != nil {
		return xerrors.Errorf("initializeNote() error: %w", err)
	}
	err = b.fileSystem.CommitAll(fs.M("Initialize", "Assets"))
	if err != nil {
		return xerrors.Errorf("CommitAll(assets) error: %w", err)
	}

	if name == "" {
		return nil
	}

	//名称のデータをコピー

	return nil
}

func (b *Binder) initializeNote() error {
	//新規作成の為、EditNoteは利用できないので注意
	var index json.Note
	index.Id = NoteRootId
	index.ParentId = ""
	index.Name = "Index"
	index.LayoutTemplate = TemplateLayoutId
	index.ContentTemplate = TemplateIndexId

	_, err := b.createNote(&index)
	if err != nil {
		return fmt.Errorf("createNote(index) error\n%+v", err)
	}

	// ルートノートのStructureを直接作成（EditNoteは使えないため）
	var rootStruct model.Structure
	rootStruct.Id = NoteRootId
	rootStruct.ParentId = ""
	rootStruct.Seq = 1
	rootStruct.Typ = "note"
	rootStruct.Name = "Index"
	rootStruct.Alias = NoteRootId
	err = b.db.InsertStructure(&rootStruct, b.op)
	if err != nil {
		return fmt.Errorf("InsertStructure(index) error\n%+v", err)
	}

	var child json.Note
	child.Id = ""
	child.ParentId = NoteRootId
	child.Name = "Content"
	child.LayoutTemplate = TemplateLayoutId
	child.ContentTemplate = TemplateContentId

	_, err = b.EditNote(&child, "")
	if err != nil {
		return fmt.Errorf("content register error\n%+v", err)
	}
	return nil
}

func (b *Binder) initializeDiagram() error {

	//ダイアグラム
	var diagram json.Diagram
	diagram.Id = ""
	diagram.ParentId = NoteRootId
	diagram.Name = "Diagram"

	_, err := b.EditDiagram(&diagram)
	if err != nil {
		return fmt.Errorf("diagram register error\n%+v", err)
	}
	return nil
}

func (b *Binder) initializeAsset() error {
	//アセット作成
	//ダイアグラム
	var asset json.Asset
	asset.Id = ""
	asset.ParentId = NoteRootId
	asset.Name = "Asset"
	asset.Alias = "DataAsset"

	_, err := b.editAsset(&asset, []byte("add a logo or something"))
	if err != nil {
		return fmt.Errorf("diagram register error\n%+v", err)
	}
	return nil
}

func (b *Binder) initializeTemplate() error {

	var layout json.Template
	layout.Id = TemplateLayoutId
	layout.Typ = string(json.LayoutTemplateType)
	layout.Name = "Layout"
	_, err := b.createTemplate(&layout)
	if err != nil {
		return fmt.Errorf("layout register error\n%+v", err)
	}

	var index json.Template
	index.Id = TemplateIndexId
	index.Typ = string(json.ContentTemplateType)
	index.Name = "Index"
	_, err = b.createTemplate(&index)
	if err != nil {
		return fmt.Errorf("index register error\n%+v", err)
	}

	var content json.Template
	content.Id = TemplateContentId
	content.Typ = string(json.ContentTemplateType)
	content.Name = "Content"
	_, err = b.createTemplate(&content)
	if err != nil {
		return fmt.Errorf("content register error\n%+v", err)
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
