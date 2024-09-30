package binder_test

import (
	"binder"
	"binder/db/model"
	"binder/fs"
	"binder/test"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
)

func TestInstall(t *testing.T) {

	dir := filepath.Join(test.Dir, "create")
	err := binder.Install(dir, test.LatestVersion)
	if err != nil {
		t.Fatalf("create error: %+v\n", err)
	}

	files := []string{
		filepath.Join(dir, "templates"),
		filepath.Join(dir, "notes"),
		filepath.Join(dir, "diagrams"),
		filepath.Join(dir, "assets"),
		filepath.Join(dir, "db"),
		filepath.Join(dir, "db", "config.csv"),
		filepath.Join(dir, "db", "templates.csv"),
		filepath.Join(dir, "db", "notes.csv"),
		filepath.Join(dir, "db", "diagrams.csv"),
		filepath.Join(dir, "db", "assets.csv"),
	}

	//データベース確認
	for _, f := range files {
		_, err = os.Stat(f)
		if err != nil {
			t.Errorf("not exists file[%s]", f)
		}
	}
}

func TestInitialize(t *testing.T) {

	dir := filepath.Join(test.Dir, "init")
	err := binder.Install(dir, test.LatestVersion)
	if err != nil {
		t.Fatalf("create error: %v", err)
	}

	b, err := binder.Load(dir, test.LatestVersion)
	if err != nil {
		t.Fatalf("Binder Load() error: %v", err)
	}
	defer b.Close()

	err = b.Initialize("simple")
	if err != nil {
		t.Fatalf("Binder Initialize() error: %v", err)
	}

	//DB確認
	//設定１件
	c, err := b.GetConfig()
	if err != nil {
		t.Errorf("GetConfig() error: %v", err)
	} else if c == nil {
		t.Errorf("GetConfig() pointer is nil")
	}

	//テスト用のインスタンス
	inst := b.GetDB()
	//テンプレート３件
	tmpls, err := inst.FindTemplates()
	if err != nil {
		t.Errorf("db.FindTemplates() error: %v", err)
	} else if len(tmpls) != 3 {
		t.Errorf("db.FindTemplates() templates length want 3 got %d", len(tmpls))
	}

	//ノート２件
	notes, err := inst.FindNotes()
	if err != nil {
		t.Errorf("db.FindNotes() error: %v", err)
	} else if len(notes) != 2 {
		t.Errorf("db.FindNotes() notes length want 2 got %d", len(notes))
	}

	//ダイアグラム１件
	diagrams, err := inst.FindDiagrams()
	if err != nil {
		t.Errorf("db.FindDiagrams() error: %v", err)
	} else if len(diagrams) != 1 {
		t.Errorf("db.FindDiagrams() diagrams length want 1 got %d", len(diagrams))
	}

	//アセット１件
	assets, err := inst.FindAssets()
	if err != nil {
		t.Errorf("db.FindAssets() error: %v", err)
	} else if len(assets) != 1 {
		t.Errorf("db.FindAssets() asset length want 1 got %d", len(assets))
	}

	//テンプレートファイル確認
	f := b.GetFS()
	tempIds := make(map[string]*model.Template)
	for _, tmpl := range tmpls {
		tempIds[tmpl.Id] = tmpl
	}

	for id, _ := range tempIds {
		fn := fs.TemplateFile(id)
		_, err = f.Stat(fn)
		if err != nil {
			t.Errorf("template [%s] file not found error: %v", id, err)
		}
	}

	noteIds := make(map[string]*model.Note)
	for _, n := range notes {
		noteIds[n.Id] = n
	}
	for id, _ := range noteIds {
		fn := fs.NoteFile(id)
		_, err = f.Stat(fn)
		if err != nil {
			t.Errorf("note [%s] file not found error: %v", id, err)
		}
	}

	diagramId := diagrams[0].Id
	asset := assets[0]
	fn := fs.DiagramFile(diagramId)
	_, err = f.Stat(fn)
	if err != nil {
		t.Errorf("diagram [%s] file not found error: %v", diagramId, err)
	}

	fn = fs.AssetFile(asset)

	slog.Error(fn)
	_, err = f.Stat(fn)
	if err != nil {
		t.Errorf("asset [%s] file not found error: %v", asset.Id, err)
	}

	//Gitはステータスがすべて登録されていること

}
