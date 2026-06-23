package fs_test

import (
	"bytes"
	"testing"

	"binder/fs"
)

// TestResetHardToSnapshot は、移行前スナップショットへのロールバックが
// 「スナップショット時点の内容」を復元し、その後の変更（移行コミット相当）を
// 破棄することを検証する。これは convert.Run() のデータ保全の中核プリミティブ。
func TestResetHardToSnapshot(t *testing.T) {
	f := createFileSystem(t, "reset_snapshot")

	n := newNote("reset1", "reset-alias")
	if _, err := f.CreateNoteFile(n); err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}

	// 初期コミット（記録済み状態）
	recorded := []byte("# recorded\n")
	if err := f.WriteNoteText(n.Id, recorded); err != nil {
		t.Fatalf("WriteNoteText(recorded) error: %v", err)
	}
	if err := f.Commit(fs.M("Create Note", n.Id), fs.NoteFile(n.Id)); err != nil {
		t.Fatalf("Commit(initial) error: %v", err)
	}

	// 未記録の作業（本文編集）→ 安全スナップショットとしてコミットし、戻り先を記録
	unrecorded := []byte("# recorded\n\nunrecorded work that must survive\n")
	if err := f.WriteNoteText(n.Id, unrecorded); err != nil {
		t.Fatalf("WriteNoteText(unrecorded) error: %v", err)
	}
	if err := f.CommitAll(fs.M("Pre-migration safety snapshot", "Schema")); err != nil {
		t.Fatalf("CommitAll(snapshot) error: %v", err)
	}
	snap, err := f.HeadHash()
	if err != nil {
		t.Fatalf("HeadHash(snapshot) error: %v", err)
	}

	// 移行コミット相当の変更を加えてコミット（失敗時はこれを破棄したい）
	migrated := []byte("# migrated away\n")
	if err := f.WriteNoteText(n.Id, migrated); err != nil {
		t.Fatalf("WriteNoteText(migrated) error: %v", err)
	}
	if err := f.Commit(fs.M("Migration commit", n.Id), fs.NoteFile(n.Id)); err != nil {
		t.Fatalf("Commit(migration) error: %v", err)
	}

	// ロールバック: スナップショットへ戻す
	if err := f.ResetHardTo(snap.String()); err != nil {
		t.Fatalf("ResetHardTo() error: %v", err)
	}

	// スナップショット時点の未記録作業が復元され、移行コミットは破棄されていること
	var buf bytes.Buffer
	if err := f.ReadNoteText(&buf, n.Id); err != nil {
		t.Fatalf("ReadNoteText() error: %v", err)
	}
	if !bytes.Equal(buf.Bytes(), unrecorded) {
		t.Errorf("after rollback got %q, want snapshot content %q", buf.String(), string(unrecorded))
	}

	// HEAD がスナップショットに戻っていること（移行コミットへ着地していない）
	head, err := f.HeadHash()
	if err != nil {
		t.Fatalf("HeadHash() error: %v", err)
	}
	if head != snap {
		t.Errorf("HEAD = %s, want snapshot %s", head, snap)
	}
}

// TestResetHardToEmpty は空文字指定で従来の ResetHard（HEAD へのリセット）と
// 同等に振る舞うことを検証する。
func TestResetHardToEmpty(t *testing.T) {
	f := createFileSystem(t, "reset_empty")

	n := newNote("reset2", "reset-alias2")
	if _, err := f.CreateNoteFile(n); err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}
	committed := []byte("# committed\n")
	if err := f.WriteNoteText(n.Id, committed); err != nil {
		t.Fatalf("WriteNoteText() error: %v", err)
	}
	if err := f.Commit(fs.M("Create Note", n.Id), fs.NoteFile(n.Id)); err != nil {
		t.Fatalf("Commit() error: %v", err)
	}

	// 未記録の変更を加える
	if err := f.WriteNoteText(n.Id, []byte("# dirty uncommitted\n")); err != nil {
		t.Fatalf("WriteNoteText(dirty) error: %v", err)
	}

	// 空文字指定 = HEAD へのハードリセット → 未記録変更は破棄される
	if err := f.ResetHardTo(""); err != nil {
		t.Fatalf("ResetHardTo(\"\") error: %v", err)
	}

	var buf bytes.Buffer
	if err := f.ReadNoteText(&buf, n.Id); err != nil {
		t.Fatalf("ReadNoteText() error: %v", err)
	}
	if !bytes.Equal(buf.Bytes(), committed) {
		t.Errorf("after reset got %q, want committed content %q", buf.String(), string(committed))
	}
}
