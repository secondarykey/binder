package binder_test

import (
	"binder/test"
	"testing"
)

func TestGetNote(t *testing.T) {
}

func TestRemoveNote(t *testing.T) {
}

func TestEditNote(t *testing.T) {
}

func TestOpenNote(t *testing.T) {
}

func TestSaveNote(t *testing.T) {
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
