package binder_test

import (
	"binder"
	"binder/api/json"
	"binder/test"
	"bytes"
	"errors"
	"testing"
)

func findNonIndexNote(leaves []*json.Leaf) *json.Leaf {
	for _, l := range leaves {
		if l.Type == "note" && l.Id != "index" {
			return l
		}
		if found := findNonIndexNote(l.Children); found != nil {
			return found
		}
	}
	return nil
}

func getFirstNoteId(t *testing.T, b interface {
	GetBinderTree() (*json.Tree, error)
}) string {
	t.Helper()
	tree, err := b.GetBinderTree()
	if err != nil {
		t.Fatalf("GetBinderTree() error: %v", err)
	}
	leaf := findLeafByType(tree.Data, "note")
	if leaf == nil {
		t.Fatal("no note found in binder tree")
	}
	return leaf.Id
}

func TestGetNote(t *testing.T) {
	b := test.CreateBinder(t, "get_note")
	defer b.Close()

	id := getFirstNoteId(t, b)

	note, err := b.GetNote(id)
	if err != nil {
		t.Fatalf("GetNote(%q) error: %v", id, err)
	}
	if note == nil {
		t.Fatal("GetNote() returned nil")
	}
	if note.Id != id {
		t.Errorf("GetNote().Id = %q, want %q", note.Id, id)
	}
}

func TestRemoveNote(t *testing.T) {
	b := test.CreateBinder(t, "remove_note")
	defer b.Close()

	tree, err := b.GetBinderTree()
	if err != nil {
		t.Fatalf("GetBinderTree() error: %v", err)
	}
	leaf := findNonIndexNote(tree.Data)
	if leaf == nil {
		t.Fatal("no non-index note found in binder tree")
	}
	id := leaf.Id

	_, err = b.RemoveNote(id, false)
	if err != nil {
		t.Fatalf("RemoveNote(%q) error: %v", id, err)
	}

	_, err = b.GetNote(id)
	if err == nil {
		t.Error("GetNote() after RemoveNote should return error")
	}
}

func TestEditNote(t *testing.T) {
	b := test.CreateBinder(t, "edit_note")
	defer b.Close()

	id := getFirstNoteId(t, b)

	note, err := b.GetNote(id)
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}

	note.Name = "EditedNoteName"
	edited, err := b.EditNote(note, "")
	if err != nil {
		t.Fatalf("EditNote() error: %v", err)
	}
	if edited.Name != "EditedNoteName" {
		t.Errorf("EditNote().Name = %q, want %q", edited.Name, "EditedNoteName")
	}

	got, err := b.GetNote(id)
	if err != nil {
		t.Fatalf("GetNote() after edit error: %v", err)
	}
	if got.Name != "EditedNoteName" {
		t.Errorf("Name after edit = %q, want %q", got.Name, "EditedNoteName")
	}
}

func TestOpenNote(t *testing.T) {
	b := test.CreateBinder(t, "open_note")
	defer b.Close()

	id := getFirstNoteId(t, b)

	var buf bytes.Buffer
	err := b.ReadNote(&buf, id)
	if err != nil {
		t.Fatalf("ReadNote() error: %v", err)
	}
	// Note content may be empty for a fresh binder template, so just verify no error
}

func TestSaveNote(t *testing.T) {
	b := test.CreateBinder(t, "save_note")
	defer b.Close()

	id := getFirstNoteId(t, b)

	content := []byte("# Test Content\n\nHello, world!")
	err := b.SaveNote(id, content)
	if err != nil {
		t.Fatalf("SaveNote() error: %v", err)
	}

	var buf bytes.Buffer
	err = b.ReadNote(&buf, id)
	if err != nil {
		t.Fatalf("ReadNote() after save error: %v", err)
	}
	if buf.String() != string(content) {
		t.Errorf("ReadNote() after save = %q, want %q", buf.String(), string(content))
	}
}

func TestGetUnpublishedNotes(t *testing.T) {
	b := test.CreateBinder(t, "publish_notes")
	defer b.Close()

	all, err := b.GetUnpublishedNotes()
	if err != nil {
		t.Errorf("GetUnpublishedNotes() error: %v", err)
	} else if len(all) != 2 {
		t.Errorf("GetUnpublishedNotes() length want 2 got %d", len(all))
	}

}

// 下層があるノートは withChildren=false では消せず、true のときだけ
// ノート・ダイアグラム・アセット・レイヤーごと消えて、未記録が残らないことを確かめる。
func TestRemoveNoteWithChildren(t *testing.T) {
	b := test.CreateBinder(t, "remove_note_children")
	defer b.Close()

	parent, err := b.EditNote(&json.Note{Name: "Parent", ParentId: "index"}, "")
	if err != nil {
		t.Fatalf("EditNote(parent) error: %v", err)
	}
	child, err := b.EditNote(&json.Note{Name: "Child", ParentId: parent.Id}, "")
	if err != nil {
		t.Fatalf("EditNote(child) error: %v", err)
	}
	diagram, err := b.EditDiagram(&json.Diagram{Name: "Diagram", ParentId: child.Id})
	if err != nil {
		t.Fatalf("EditDiagram() error: %v", err)
	}
	asset, err := b.AddTextAsset(parent.Id, false)
	if err != nil {
		t.Fatalf("AddTextAsset() error: %v", err)
	}
	layer, err := b.EditLayer(&json.Layer{Name: "Layer", ParentId: asset.Id})
	if err != nil {
		t.Fatalf("EditLayer() error: %v", err)
	}

	// 残す側（兄弟のノート）
	sibling, err := b.EditNote(&json.Note{Name: "Sibling", ParentId: "index"}, "")
	if err != nil {
		t.Fatalf("EditNote(sibling) error: %v", err)
	}

	has, err := b.HasChildren(parent.Id)
	if err != nil || !has {
		t.Fatalf("HasChildren(parent) = %v, %v; want true", has, err)
	}
	has, err = b.HasChildren(sibling.Id)
	if err != nil || has {
		t.Fatalf("HasChildren(sibling) = %v, %v; want false", has, err)
	}

	// チェックなしでは消せない
	if _, err := b.RemoveNote(parent.Id, false); !errors.Is(err, binder.ErrNoteHasChildren) {
		t.Fatalf("RemoveNote(parent, false) error = %v, want ErrNoteHasChildren", err)
	}
	if _, err := b.GetNote(parent.Id); err != nil {
		t.Fatalf("parent must remain after refused removal: %v", err)
	}

	// チェックありなら下層ごと消える
	if _, err := b.RemoveNote(parent.Id, true); err != nil {
		t.Fatalf("RemoveNote(parent, true) error: %v", err)
	}

	d := b.GetDB()
	for _, id := range []string{parent.Id, child.Id, diagram.Id, asset.Id, layer.Id} {
		if _, err := d.GetStructure(id); err == nil {
			t.Errorf("structure %s still exists", id)
		}
	}
	if _, err := b.GetNote(child.Id); err == nil {
		t.Errorf("child note still exists")
	}
	if _, err := d.GetDiagram(diagram.Id); err == nil {
		t.Errorf("diagram still exists")
	}
	if _, err := d.GetAsset(asset.Id); err == nil {
		t.Errorf("asset still exists")
	}
	if _, err := d.GetLayer(layer.Id); err == nil {
		t.Errorf("layer still exists")
	}

	f := b.GetFS()
	for _, fn := range []string{"notes/" + parent.Id + ".md", "notes/" + child.Id + ".md", "diagrams/" + diagram.Id + ".md", "assets/" + asset.Id} {
		if _, err := f.Stat(fn); err == nil {
			t.Errorf("%s still exists", fn)
		}
	}

	if _, err := b.GetNote(sibling.Id); err != nil {
		t.Errorf("sibling note must remain: %v", err)
	}

	// 1 回の記録にまとまり、未記録が残っていない
	ids, err := b.GetModifiedIds()
	if err != nil {
		t.Fatalf("GetModifiedIds() error: %v", err)
	}
	if len(ids) != 0 {
		t.Errorf("modified ids after removal = %v, want none", ids)
	}
}
