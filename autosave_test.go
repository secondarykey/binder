package binder_test

import (
	"strings"
	"testing"

	"binder/test"
)

func TestAutoSave(t *testing.T) {
	b := test.CreateBinder(t, "autosave")
	defer b.Close()

	id := getFirstNoteId(t, b)

	// 変更がない場合は 0 件（コミットなし）
	n, err := b.AutoSave()
	if err != nil {
		t.Fatalf("AutoSave() (clean) error: %v", err)
	}
	if n != 0 {
		t.Errorf("AutoSave() with no changes = %d, want 0", n)
	}

	// 未記録の本文変更を作る
	if err := b.SaveNote(id, []byte("# changed\n\nauto save target")); err != nil {
		t.Fatalf("SaveNote() error: %v", err)
	}

	// AutoSave で1件コミットされる
	n, err = b.AutoSave()
	if err != nil {
		t.Fatalf("AutoSave() error: %v", err)
	}
	if n != 1 {
		t.Errorf("AutoSave() = %d, want 1", n)
	}

	// 直近コミットのメッセージが "Auto Save" 接頭子 + 階層表示であること
	history, _, err := b.GetOverallHistory(1, 0)
	if err != nil {
		t.Fatalf("GetOverallHistory() error: %v", err)
	}
	if len(history) == 0 {
		t.Fatal("GetOverallHistory() returned no commits")
	}
	msg := history[0].Message
	if !strings.HasPrefix(msg, "Auto Save") {
		t.Errorf("commit message = %q, want prefix %q", msg, "Auto Save")
	}
	if !strings.Contains(msg, "Note:") {
		t.Errorf("commit message = %q, want hierarchy section %q", msg, "Note:")
	}

	// コミット直後は変更がないため 0 件（冪等）
	n, err = b.AutoSave()
	if err != nil {
		t.Fatalf("AutoSave() (after commit) error: %v", err)
	}
	if n != 0 {
		t.Errorf("AutoSave() after commit = %d, want 0", n)
	}
}
