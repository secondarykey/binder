package fs

import (
	"os"
	"path/filepath"
	"testing"

	"binder/api/json"
)

// newStatusTestFS は Status キャッシュ検証用の一時リポジトリを作成し、
// ノートを1件コミット済みの状態にして返す。
func newStatusTestFS(t *testing.T) (*FileSystem, string, *json.Note) {
	t.Helper()
	dir := t.TempDir()
	f, err := New(dir)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	n := &json.Note{}
	n.Id = "status-cache-note"
	n.Alias = "status-cache-alias"
	if _, err := f.CreateNoteFile(n); err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}
	if err := f.WriteNoteText(n.Id, []byte("# v1\n")); err != nil {
		t.Fatalf("WriteNoteText() error: %v", err)
	}
	if err := f.Commit(M("Create Note", n.Id), NoteFile(n.Id)); err != nil {
		t.Fatalf("Commit() error: %v", err)
	}
	return f, dir, n
}

// TestStatusCacheAndInvalidate は Status() が TTL 内はキャッシュを返し、
// invalidateStatus() で即時に再計算されることを検証する。
func TestStatusCacheAndInvalidate(t *testing.T) {
	f, dir, n := newStatusTestFS(t)

	// コミット直後: 変更なしの結果がキャッシュされる
	s, err := f.Status()
	if err != nil {
		t.Fatalf("Status() error: %v", err)
	}
	if len(s) != 0 {
		t.Fatalf("want clean status, got %d entries", len(s))
	}
	if f.statusAt.IsZero() {
		t.Error("Status() の結果がキャッシュされていない")
	}

	// fs を経由しない外部変更は TTL 内はキャッシュに隠れる（= キャッシュが返っている）
	p := filepath.Join(dir, filepath.FromSlash(NoteFile(n.Id)))
	if err := os.WriteFile(p, []byte("# external change\n"), 0644); err != nil {
		t.Fatalf("os.WriteFile() error: %v", err)
	}
	s, err = f.Status()
	if err != nil {
		t.Fatalf("Status() error: %v", err)
	}
	if len(s) != 0 {
		t.Errorf("TTL 内はキャッシュが返るはずが、外部変更が見えている: %d entries", len(s))
	}

	// 無効化後は外部変更が反映される
	f.invalidateStatus()
	s, err = f.Status()
	if err != nil {
		t.Fatalf("Status() error: %v", err)
	}
	if len(s) != 1 {
		t.Errorf("invalidate 後は外部変更が見えるはず: got %d entries", len(s))
	}
}

// TestStatusReflectsFsWriteImmediately は fs 経由の書き込みが
// キャッシュに関係なく即時に Status() に反映されることを検証する。
func TestStatusReflectsFsWriteImmediately(t *testing.T) {
	f, _, n := newStatusTestFS(t)

	// キャッシュを作る
	if _, err := f.Status(); err != nil {
		t.Fatalf("Status() error: %v", err)
	}

	// fs 経由の書き込みは writeFile 内で invalidate される
	if err := f.WriteNoteText(n.Id, []byte("# v2\n")); err != nil {
		t.Fatalf("WriteNoteText() error: %v", err)
	}
	s, err := f.Status()
	if err != nil {
		t.Fatalf("Status() error: %v", err)
	}
	if len(s) != 1 {
		t.Errorf("fs 経由の変更が即時反映されていない: got %d entries", len(s))
	}

	// コミットで再び変更なしに戻る（commit 内で invalidate される）
	if err := f.Commit(M("Update Note", n.Id), NoteFile(n.Id)); err != nil {
		t.Fatalf("Commit() error: %v", err)
	}
	s, err = f.Status()
	if err != nil {
		t.Fatalf("Status() error: %v", err)
	}
	if len(s) != 0 {
		t.Errorf("コミット後は変更なしのはず: got %d entries", len(s))
	}
}
