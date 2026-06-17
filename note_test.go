package binder_test

import (
	"binder/api/json"
	"binder/test"
	"bytes"
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

	_, err = b.RemoveNote(id)
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
