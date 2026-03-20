package binder_test

import (
	"binder"
	"binder/api/json"
	"binder/fs"
	"binder/setup"
	"binder/test"
	"log/slog"
	"path/filepath"
	"testing"
)

func TestInitialize(t *testing.T) {

	dir := filepath.Join(test.Dir, "init")
	err := setup.Install(dir, test.LatestVersion, "simple")
	if err != nil {
		t.Fatalf("create error: %v", err)
	}

	// Install内でInitializeも実行済み。Loadして結果を検証する
	b, err := binder.Load(dir)
	if err != nil {
		t.Fatalf("Binder Load() error: %v", err)
	}
	defer b.Close()

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

	tempIds := make(map[string]*json.Template)
	for _, tmpl := range tmpls {
		tempIds[tmpl.Id] = tmpl.To()
	}

	for id, _ := range tempIds {
		fn := fs.TemplateFile(id)
		_, err = f.Stat(fn)
		if err != nil {
			t.Errorf("template [%s] file not found error: %v", id, err)
		}
	}

	noteIds := make(map[string]*json.Note)
	for _, n := range notes {
		noteIds[n.Id] = n.To()
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

	ja := asset.To()
	// Structure経由でparentIdを取得
	assetStruct, err := inst.GetStructure(asset.Id)
	if err != nil {
		t.Fatalf("GetStructure(asset) error: %v", err)
	}
	ja.ApplyStructure(assetStruct.To())
	fn = fs.AssetFile(ja)

	slog.Error(fn)
	_, err = f.Stat(fn)
	if err != nil {
		t.Errorf("asset [%s] file not found error: %v", asset.Id, err)
	}

	//Gitはステータスがすべて登録されていること

}
