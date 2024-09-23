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

func TestGetPublishNotes(t *testing.T) {
	b := test.CreateBinder(t, "publish_notes")
	defer b.Close()

	all, err := b.GetPublishNotes()
	if err != nil {
		t.Errorf("GetPublishNotes() error: %v", err)
	} else if len(all) != 2 {
		t.Errorf("GetPublishNotes() length want 2 got %d", len(all))
	}

}
