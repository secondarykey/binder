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
