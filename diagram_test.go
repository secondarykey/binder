package binder_test

import (
	"binder/api/json"
	"binder/test"
	"bytes"
	"testing"
)

func createDiagram(t *testing.T, b interface {
	GetBinderTree() (*json.Tree, error)
	EditDiagram(d *json.Diagram) (*json.Diagram, error)
}) *json.Diagram {
	t.Helper()
	tree, err := b.GetBinderTree()
	if err != nil {
		t.Fatalf("GetBinderTree() error: %v", err)
	}
	// Use the first note as parent
	noteLeaf := findLeafByType(tree.Data, "note")
	if noteLeaf == nil {
		t.Fatal("no note found in binder tree for diagram parent")
	}

	d := &json.Diagram{
		ParentId: noteLeaf.Id,
		Name:     "TestDiagram",
	}
	created, err := b.EditDiagram(d)
	if err != nil {
		t.Fatalf("EditDiagram() create error: %v", err)
	}
	return created
}

func TestGetDiagram(t *testing.T) {
	b := test.CreateBinder(t, "get_diagram")
	defer b.Close()

	created := createDiagram(t, b)

	got, err := b.GetDiagram(created.Id)
	if err != nil {
		t.Fatalf("GetDiagram(%q) error: %v", created.Id, err)
	}
	if got == nil {
		t.Fatal("GetDiagram() returned nil")
	}
	if got.Id != created.Id {
		t.Errorf("GetDiagram().Id = %q, want %q", got.Id, created.Id)
	}
	if got.Name != "TestDiagram" {
		t.Errorf("GetDiagram().Name = %q, want %q", got.Name, "TestDiagram")
	}
}

func TestEditDiagram(t *testing.T) {
	b := test.CreateBinder(t, "edit_diagram")
	defer b.Close()

	created := createDiagram(t, b)

	created.Name = "EditedDiagram"
	edited, err := b.EditDiagram(created)
	if err != nil {
		t.Fatalf("EditDiagram() update error: %v", err)
	}
	if edited.Name != "EditedDiagram" {
		t.Errorf("EditDiagram().Name = %q, want %q", edited.Name, "EditedDiagram")
	}

	got, err := b.GetDiagram(created.Id)
	if err != nil {
		t.Fatalf("GetDiagram() after edit error: %v", err)
	}
	if got.Name != "EditedDiagram" {
		t.Errorf("Name after edit = %q, want %q", got.Name, "EditedDiagram")
	}
}

func TestRemoveDiagram(t *testing.T) {
	b := test.CreateBinder(t, "remove_diagram")
	defer b.Close()

	created := createDiagram(t, b)

	_, err := b.RemoveDiagram(created.Id)
	if err != nil {
		t.Fatalf("RemoveDiagram() error: %v", err)
	}

	_, err = b.GetDiagram(created.Id)
	if err == nil {
		t.Error("GetDiagram() after RemoveDiagram should return error")
	}
}

func TestOpenDiagram(t *testing.T) {
	b := test.CreateBinder(t, "open_diagram")
	defer b.Close()

	created := createDiagram(t, b)

	var buf bytes.Buffer
	err := b.ReadDiagram(&buf, created.Id)
	if err != nil {
		t.Fatalf("ReadDiagram() error: %v", err)
	}
	// Newly created diagram content may be empty, just verify no error
}

func TestSaveDiagram(t *testing.T) {
	b := test.CreateBinder(t, "save_diagram")
	defer b.Close()

	created := createDiagram(t, b)

	content := []byte("graph TD;\n    A-->B;")
	err := b.SaveDiagram(created.Id, content)
	if err != nil {
		t.Fatalf("SaveDiagram() error: %v", err)
	}

	var buf bytes.Buffer
	err = b.ReadDiagram(&buf, created.Id)
	if err != nil {
		t.Fatalf("ReadDiagram() after save error: %v", err)
	}
	if buf.String() != string(content) {
		t.Errorf("ReadDiagram() after save = %q, want %q", buf.String(), string(content))
	}
}

func TestGetUnpublishedDiagrams(t *testing.T) {
	b := test.CreateBinder(t, "publish_diagrams")

	// ダイアグラムを作成
	d := &json.Diagram{
		ParentId:      "index",
		Name:          "TestDiagram",
		StyleTemplate: "diagram_style",
	}
	_, err := b.EditDiagram(d)
	if err != nil {
		t.Fatalf("EditDiagram() error: %v", err)
	}

	all, err := b.GetUnpublishedDiagrams()
	if err != nil {
		t.Errorf("GetUnpublishedDiagrams() error: %v", err)
	} else if len(all) != 1 {
		t.Errorf("GetUnpublishedDiagrams() length want 1 got %d", len(all))
	}

	//公開する

	//更新する

	//非公開にする
}
