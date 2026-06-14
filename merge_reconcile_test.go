package binder_test

import (
	"binder/test"

	"os"
	"path/filepath"
	"testing"
)

// orphan な note 内容ファイル（structure 行なし）が ReconcileMergedTree で
// ツリー（index 直下）へ復元されることを検証する。
func TestReconcileMergedTreeRestoresOrphanNote(t *testing.T) {
	const work = "reconcile_orphan"
	b := test.CreateBinder(t, work)
	defer b.Close()

	const orphanId = "orphan-note-0001"

	// structure 行を作らずに notes/<id>.md だけを直接配置（削除vs内容変更の
	// 競合でユーザーが内容を残したケースを再現）
	mdPath := filepath.Join(test.Dir, work, "notes", orphanId+".md")
	if err := os.WriteFile(mdPath, []byte("# orphan content\n"), 0644); err != nil {
		t.Fatalf("WriteFile() error: %v", err)
	}

	// 復元前は structure 行が存在しない
	if _, err := b.GetStructure(orphanId); err == nil {
		t.Fatalf("orphan が事前に structure 行を持っている")
	}

	restored, err := b.ReconcileMergedTree()
	if err != nil {
		t.Fatalf("ReconcileMergedTree() error: %v", err)
	}

	if len(restored) != 1 || restored[0].Id != orphanId || restored[0].Typ != "note" {
		t.Fatalf("restored = %+v, want 1 note %s", restored, orphanId)
	}

	// 復元後は index 直下の note として structure 行が存在する
	s, err := b.GetStructure(orphanId)
	if err != nil {
		t.Fatalf("復元後 GetStructure() error: %v", err)
	}
	if s.Typ != "note" {
		t.Errorf("Typ = %q, want \"note\"", s.Typ)
	}
	if s.ParentId != "index" {
		t.Errorf("ParentId = %q, want \"index\"", s.ParentId)
	}
}

// orphan が無い場合は復元もコミットも発生しないことを検証する。
func TestReconcileMergedTreeNoOrphan(t *testing.T) {
	b := test.CreateBinder(t, "reconcile_clean")
	defer b.Close()

	restored, err := b.ReconcileMergedTree()
	if err != nil {
		t.Fatalf("ReconcileMergedTree() error: %v", err)
	}
	if len(restored) != 0 {
		t.Fatalf("restored = %+v, want empty", restored)
	}
}
