package setup_test

import (
	"binder"
	"binder/api/json"
	"binder/setup"
	"binder/test"

	"path/filepath"
	"testing"
)

func TestInitialize(t *testing.T) {

	dir := filepath.Join(test.Dir, "init")
	err := setup.Install(dir, test.LatestVersion, "simple", "")
	if err != nil {
		t.Fatalf("create error: %v", err)
	}

	b, err := binder.Load(dir)
	if err != nil {
		t.Fatalf("Binder Load() error: %v", err)
	}
	defer b.Close()

	// 設定が取得できること
	c, err := b.GetConfig()
	if err != nil {
		t.Errorf("GetConfig() error: %v", err)
	} else if c == nil {
		t.Errorf("GetConfig() pointer is nil")
	}

	// ツリーを取得してエンティティ数を検証
	tree, err := b.GetBinderTree()
	if err != nil {
		t.Fatalf("GetBinderTree() error: %v", err)
	}

	// simpleテンプレート: ノート2件、ダイアグラム0件、アセット1件
	var noteCount, diagramCount, assetCount int
	countLeaves(tree.Data, &noteCount, &diagramCount, &assetCount)

	if noteCount != 2 {
		t.Errorf("notes count: want 2, got %d", noteCount)
	}
	if diagramCount != 0 {
		t.Errorf("diagrams count: want 0, got %d", diagramCount)
	}
	if assetCount != 1 {
		t.Errorf("assets count: want 1, got %d", assetCount)
	}

	// テンプレート3件（layout, content, diagram_style）
	layouts, contents, diagramTemplates, err := b.GetHTMLTemplates()
	if err != nil {
		t.Fatalf("GetHTMLTemplates() error: %v", err)
	}
	templateCount := len(layouts) + len(contents) + len(diagramTemplates)
	if templateCount != 3 {
		t.Errorf("templates count: want 3, got %d", templateCount)
	}

	// 個別エンティティのアクセス確認
	verifyLeafAccess(t, b, tree.Data)
}

func countLeaves(leaves []*json.Leaf, notes, diagrams, assets *int) {
	for _, leaf := range leaves {
		switch leaf.Type {
		case "note":
			*notes++
		case "diagram":
			*diagrams++
		case "asset":
			*assets++
		}
		countLeaves(leaf.Children, notes, diagrams, assets)
	}
}

func verifyLeafAccess(t *testing.T, b *binder.Binder, leaves []*json.Leaf) {
	t.Helper()
	for _, leaf := range leaves {
		switch leaf.Type {
		case "note":
			if _, err := b.GetNote(leaf.Id); err != nil {
				t.Errorf("GetNote(%s) error: %v", leaf.Id, err)
			}
		case "diagram":
			if _, err := b.GetDiagram(leaf.Id); err != nil {
				t.Errorf("GetDiagram(%s) error: %v", leaf.Id, err)
			}
		case "asset":
			if _, err := b.GetAsset(leaf.Id); err != nil {
				t.Errorf("GetAsset(%s) error: %v", leaf.Id, err)
			}
		}
		verifyLeafAccess(t, b, leaf.Children)
	}
}
