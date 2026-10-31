package binder_test

import (
	"binder/api/json"
	"binder/test"
	"testing"
)

func findLeafByType(leaves []*json.Leaf, typ string) *json.Leaf {
	for _, l := range leaves {
		if l.Type == typ {
			return l
		}
		if found := findLeafByType(l.Children, typ); found != nil {
			return found
		}
	}
	return nil
}

func TestGetBinderTree(t *testing.T) {
	b := test.CreateBinder(t, "binder_tree")
	defer b.Close()

	tree, err := b.GetBinderTree()
	if err != nil {
		t.Fatalf("GetBinderTree() error: %v", err)
	}
	if tree == nil {
		t.Fatal("GetBinderTree() returned nil")
	}
	if tree.Data == nil {
		t.Fatal("GetBinderTree().Data is nil")
	}
	if len(tree.Data) == 0 {
		t.Error("GetBinderTree().Data is empty")
	}
}

// TestGetBinderTreeAssetMime はアセットの葉に MIME が入ることを検証する。
// エディタの ID 挿入が、画像かどうかで入れる書き方を変えるのに使う。
func TestGetBinderTreeAssetMime(t *testing.T) {
	b := test.CreateBinder(t, "binder_tree_mime")
	defer b.Close()

	tree, err := b.GetBinderTree()
	if err != nil {
		t.Fatalf("GetBinderTree() error: %v", err)
	}
	leaf := findLeafByType(tree.Data, "asset")
	if leaf == nil {
		t.Skip("no asset in binder tree")
	}
	a, err := b.GetAsset(leaf.Id)
	if err != nil {
		t.Fatalf("GetAsset() error: %v", err)
	}
	if leaf.Mime != a.Mime {
		t.Errorf("leaf.Mime = %q, want %q", leaf.Mime, a.Mime)
	}
	if leaf.Mime == "" {
		t.Error("leaf.Mime is empty")
	}
}

func TestGetTemplateTree(t *testing.T) {
	b := test.CreateBinder(t, "template_tree")
	defer b.Close()

	tree, err := b.GetTemplateTree()
	if err != nil {
		t.Fatalf("GetTemplateTree() error: %v", err)
	}
	if tree == nil {
		t.Fatal("GetTemplateTree() returned nil")
	}
	if tree.Data == nil {
		t.Fatal("GetTemplateTree().Data is nil")
	}
}
