package setup_test

import (
	"binder/db"
	"binder/setup"
	"binder/test"
	"os"
	"path/filepath"
	"testing"
)

func TestInstall(t *testing.T) {

	dir := filepath.Join(test.Dir, "create")
	err := setup.Install(dir, test.LatestVersion, "simple", "")
	if err != nil {
		t.Fatalf("create error: %+v\n", err)
	}

	files := []string{
		filepath.Join(dir, "binder.json"),
		filepath.Join(dir, "templates"),
		filepath.Join(dir, "notes"),
		filepath.Join(dir, "diagrams"),
		filepath.Join(dir, "assets"),
		filepath.Join(dir, "db"),
		filepath.Join(dir, "db", "templates.csv"),
		filepath.Join(dir, "db", "notes.csv"),
		filepath.Join(dir, "db", "diagrams.csv"),
		filepath.Join(dir, "db", "assets.csv"),
		filepath.Join(dir, "db", "structures.csv"),
	}

	//データベース確認
	for _, f := range files {
		_, err = os.Stat(f)
		if err != nil {
			t.Errorf("not exists file[%s]", f)
		}
	}

	// config.csvが存在しないことを確認
	configCSV := filepath.Join(dir, "db", "config.csv")
	if _, err = os.Stat(configCSV); err == nil {
		t.Errorf("config.csv should not exist in 0.4.5+")
	}
}

func TestInstallDocument(t *testing.T) {
	dir := filepath.Join(test.Dir, "create_document")
	err := setup.Install(dir, test.LatestVersion, "Document", "document")
	if err != nil {
		t.Fatalf("create error: %+v\n", err)
	}

	inst, err := db.New(filepath.Join(dir, "db"))
	if err != nil {
		t.Fatalf("db.New error: %v", err)
	}
	err = inst.Open()
	if err != nil {
		t.Fatalf("db.Open error: %v", err)
	}
	defer inst.Close()

	// テンプレート3件
	tmpls, err := inst.FindTemplates()
	if err != nil {
		t.Fatalf("FindTemplates error: %v", err)
	}
	if len(tmpls) != 3 {
		t.Errorf("templates: want 3, got %d", len(tmpls))
	}

	// ノート4件（Index, Chapter1, Chapter2, Chapter2-1）
	notes, err := inst.FindNotes()
	if err != nil {
		t.Fatalf("FindNotes error: %v", err)
	}
	if len(notes) != 4 {
		t.Errorf("notes: want 4, got %d", len(notes))
	}

	// ダイアグラム1件
	diagrams, err := inst.FindDiagrams()
	if err != nil {
		t.Fatalf("FindDiagrams error: %v", err)
	}
	if len(diagrams) != 1 {
		t.Errorf("diagrams: want 1, got %d", len(diagrams))
	}

	// アセット1件
	assets, err := inst.FindAssets()
	if err != nil {
		t.Fatalf("FindAssets error: %v", err)
	}
	if len(assets) != 1 {
		t.Errorf("assets: want 1, got %d", len(assets))
	}
	if len(assets) > 0 {
		if assets[0].Mime != "text/css" {
			t.Errorf("asset mime: want text/css, got %s", assets[0].Mime)
		}
	}

	// Chapter2-1 の親がChapter2であること確認
	structures, err := inst.FindStructures()
	if err != nil {
		t.Fatalf("FindStructures error: %v", err)
	}
	var ch21ParentId string
	for _, s := range structures {
		if s.Name == "Chapter 2-1" {
			ch21ParentId = s.ParentId
		}
	}
	if ch21ParentId != "019e389d-3c44-76dc-9e8c-1523d3e2332a" {
		t.Errorf("Chapter 2-1 parentId: want 019e389d-3c44-76dc-9e8c-1523d3e2332a, got %s", ch21ParentId)
	}

	// ノートファイルの内容が空でないこと
	indexNote := filepath.Join(dir, "notes", "index.md")
	data, err := os.ReadFile(indexNote)
	if err != nil {
		t.Errorf("ReadFile(index.md) error: %v", err)
	} else if len(data) == 0 {
		t.Errorf("index.md content is empty")
	}

	ch1Note := filepath.Join(dir, "notes", "019e389d-3c37-775d-a9bd-34623dd39f2a.md")
	data, err = os.ReadFile(ch1Note)
	if err != nil {
		t.Errorf("ReadFile(chapter1) error: %v", err)
	} else if len(data) == 0 {
		t.Errorf("chapter1 note content is empty")
	}

	// アセットファイルの存在確認
	assetFile := filepath.Join(dir, "assets", "019e38a8-26ab-737e-892a-2607ca76b639")
	data, err = os.ReadFile(assetFile)
	if err != nil {
		t.Errorf("ReadFile(asset) error: %v", err)
	} else if len(data) == 0 {
		t.Errorf("asset content is empty")
	}
}

func TestInstallBlog(t *testing.T) {
	dir := filepath.Join(test.Dir, "create_blog")
	err := setup.Install(dir, test.LatestVersion, "Blog", "blog")
	if err != nil {
		t.Fatalf("create error: %+v\n", err)
	}

	inst, err := db.New(filepath.Join(dir, "db"))
	if err != nil {
		t.Fatalf("db.New error: %v", err)
	}
	err = inst.Open()
	if err != nil {
		t.Fatalf("db.Open error: %v", err)
	}
	defer inst.Close()

	// テンプレート4件（layout, content, index, diagram_style）
	tmpls, err := inst.FindTemplates()
	if err != nil {
		t.Fatalf("FindTemplates error: %v", err)
	}
	if len(tmpls) != 4 {
		t.Errorf("templates: want 4, got %d", len(tmpls))
	}

	// ノート3件（Index, First Post, 作業用）
	notes, err := inst.FindNotes()
	if err != nil {
		t.Fatalf("FindNotes error: %v", err)
	}
	if len(notes) != 3 {
		t.Errorf("notes: want 3, got %d", len(notes))
	}

	// ダイアグラム0件
	diagrams, err := inst.FindDiagrams()
	if err != nil {
		t.Fatalf("FindDiagrams error: %v", err)
	}
	if len(diagrams) != 0 {
		t.Errorf("diagrams: want 0, got %d", len(diagrams))
	}

	// アセット1件（CSS）
	assets, err := inst.FindAssets()
	if err != nil {
		t.Fatalf("FindAssets error: %v", err)
	}
	if len(assets) != 1 {
		t.Errorf("assets: want 1, got %d", len(assets))
	}
	if len(assets) > 0 {
		if assets[0].Mime != "text/css" {
			t.Errorf("asset mime: want text/css, got %s", assets[0].Mime)
		}
	}

	// 「作業用」が非公開であること
	structures, err := inst.FindStructures()
	if err != nil {
		t.Fatalf("FindStructures error: %v", err)
	}
	for _, s := range structures {
		if s.Name == "作業用" {
			if !s.Private {
				t.Errorf("「作業用」should be private")
			}
		}
	}

	// First Post の detail が設定されていること
	for _, s := range structures {
		if s.Name == "First Post" {
			if s.Detail == "" {
				t.Errorf("First Post detail should not be empty")
			}
		}
	}

	// メタ画像の存在確認
	metaFile := filepath.Join(dir, "assets", "meta", "019e397e-6b35-7060-9e7d-9944bce01534")
	data, err := os.ReadFile(metaFile)
	if err != nil {
		t.Errorf("ReadFile(meta) error: %v", err)
	} else if len(data) == 0 {
		t.Errorf("meta image content is empty")
	}

	// First Post ノートファイルが空でないこと
	postNote := filepath.Join(dir, "notes", "019e397e-6b35-7060-9e7d-9944bce01534.md")
	data, err = os.ReadFile(postNote)
	if err != nil {
		t.Errorf("ReadFile(first_post) error: %v", err)
	} else if len(data) == 0 {
		t.Errorf("first_post note content is empty")
	}
}
