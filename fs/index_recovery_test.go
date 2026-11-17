package fs_test

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"binder/fs"
	"binder/test"
)

// TestRepairCorruptIndexRecoversFromHead は、破損した .git/index を検出した場合に
// HEAD からインデックスが再構築され、操作可能な状態に戻ることを検証する。
func TestRepairCorruptIndexRecoversFromHead(t *testing.T) {
	f := createFileSystem(t, "index_repair_head")

	n := newNote("idx1", "idx-alias")
	if _, err := f.CreateNoteFile(n); err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}

	recorded := []byte("# recorded\n")
	if err := f.WriteNoteText(n.Id, recorded); err != nil {
		t.Fatalf("WriteNoteText(recorded) error: %v", err)
	}
	if err := f.Commit(fs.M("Create Note", n.Id), fs.NoteFile(n.Id)); err != nil {
		t.Fatalf("Commit(initial) error: %v", err)
	}
	head, err := f.HeadHash()
	if err != nil {
		t.Fatalf("HeadHash() error: %v", err)
	}

	// 破損したインデックス（不正なバイト列）を書き込む
	if err := f.CorruptIndexForTest([]byte("this is not a valid git index file, definitely not")); err != nil {
		t.Fatalf("CorruptIndexForTest() error: %v", err)
	}

	// Load() 相当の検出・自動復旧を実行する
	f.RepairIndexForTest()

	// 破損したインデックスは退避されていること
	if !f.BrokenIndexBackupExistsForTest() {
		t.Errorf("broken index backup (index.broken) was not created")
	}

	// HEAD は変わらず、ワークツリーのファイル内容も保持されていること
	after, err := f.HeadHash()
	if err != nil {
		t.Fatalf("HeadHash() after repair error: %v", err)
	}
	if after != head {
		t.Errorf("HEAD changed after index repair: got %s, want %s", after, head)
	}

	var buf bytes.Buffer
	if err := f.ReadNoteText(&buf, n.Id); err != nil {
		t.Fatalf("ReadNoteText() after repair error: %v", err)
	}
	if !bytes.Equal(buf.Bytes(), recorded) {
		t.Errorf("worktree content lost after repair: got %q, want %q", buf.String(), string(recorded))
	}

	// 操作可能な状態に戻っていること（コミットできる）
	unrecorded := []byte("# recorded\n\nafter repair\n")
	if err := f.WriteNoteText(n.Id, unrecorded); err != nil {
		t.Fatalf("WriteNoteText(after repair) error: %v", err)
	}
	if err := f.Commit(fs.M("Post-repair edit", n.Id), fs.NoteFile(n.Id)); err != nil {
		t.Fatalf("Commit(after repair) error: %v", err)
	}
}

// TestRepairCorruptIndexKeepsUnrecordedAsModified は、破損時点で未記録だった
// 変更が復旧後も「未記録」として Status() に現れることを検証する
// （Mixed reset はワークツリーに触らないため）。
func TestRepairCorruptIndexKeepsUnrecordedAsModified(t *testing.T) {
	f := createFileSystem(t, "index_repair_unrecorded")

	n := newNote("idx2", "idx-alias2")
	if _, err := f.CreateNoteFile(n); err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}
	recorded := []byte("# recorded\n")
	if err := f.WriteNoteText(n.Id, recorded); err != nil {
		t.Fatalf("WriteNoteText(recorded) error: %v", err)
	}
	if err := f.Commit(fs.M("Create Note", n.Id), fs.NoteFile(n.Id)); err != nil {
		t.Fatalf("Commit(initial) error: %v", err)
	}

	// 記録されていない書きかけの変更（破損時に進行中だった操作を模す）
	unrecorded := []byte("# recorded\n\nwork in progress when index broke\n")
	if err := f.WriteNoteText(n.Id, unrecorded); err != nil {
		t.Fatalf("WriteNoteText(unrecorded) error: %v", err)
	}

	if err := f.CorruptIndexForTest([]byte("garbage garbage garbage")); err != nil {
		t.Fatalf("CorruptIndexForTest() error: %v", err)
	}

	f.RepairIndexForTest()

	// ワークツリーの書きかけ内容は保持されていること
	var buf bytes.Buffer
	if err := f.ReadNoteText(&buf, n.Id); err != nil {
		t.Fatalf("ReadNoteText() after repair error: %v", err)
	}
	if !bytes.Equal(buf.Bytes(), unrecorded) {
		t.Errorf("worktree content lost after repair: got %q, want %q", buf.String(), string(unrecorded))
	}

	// 未記録の変更として Status() に現れること
	mods, err := f.Status()
	if err != nil {
		t.Fatalf("Status() error: %v", err)
	}
	found := false
	for _, m := range mods.Notes() {
		if m.Id == n.Id {
			found = true
		}
	}
	if !found {
		t.Errorf("Status() did not report unrecorded note %s as modified: %+v", n.Id, mods)
	}
}

// newCorruptIndexBinder は、記録が 1 つあり、.git/index のチェックサムが合わないバインダーを作る。
// 別の Binder がインデックスを書き直している最中に読むと、古い前半と新しい後半が混ざって
// こうなる（index.ErrInvalidChecksum。自動復旧の対象）。
func newCorruptIndexBinder(t *testing.T, name string) (dir string, index []byte) {
	t.Helper()
	dir = filepath.Join(test.Dir, name)
	f, err := fs.New(dir)
	if err != nil {
		t.Fatalf("fs.New() error: %v", err)
	}
	n := newNote("idx-"+name, "alias-"+name)
	if _, err := f.CreateNoteFile(n); err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}
	if err := f.WriteNoteText(n.Id, []byte("# recorded\n")); err != nil {
		t.Fatalf("WriteNoteText() error: %v", err)
	}
	if err := f.Commit(fs.M("Create Note", n.Id), fs.NoteFile(n.Id)); err != nil {
		t.Fatalf("Commit() error: %v", err)
	}
	if err := f.Close(); err != nil {
		t.Fatalf("Close() error: %v", err)
	}

	p := filepath.Join(dir, ".git", "index")
	index, err = os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	index[len(index)-1] ^= 0xff // 末尾のチェックサムを壊す
	if err := os.WriteFile(p, index, 0644); err != nil {
		t.Fatal(err)
	}
	return dir, index
}

// 「開いている」印を持たずに Load したときは、インデックスが壊れて見えても書き直さない。
// バインダーを開かずに履歴を見る（*ByPath）とき、別の Binder が書いている最中のインデックスを
// 読んでも、相手のインデックスを壊さないため。
func TestLoadWithoutOpenMarkDoesNotRepairIndex(t *testing.T) {
	dir, corrupt := newCorruptIndexBinder(t, "index_repair_unlocked")

	f, err := fs.Load(dir)
	if err != nil {
		t.Fatalf("fs.Load() error: %v", err)
	}
	defer f.Close()

	got, err := os.ReadFile(filepath.Join(dir, ".git", "index"))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, corrupt) {
		t.Error("印を持たない Load がインデックスを書き換えた")
	}
	if f.BrokenIndexBackupExistsForTest() {
		t.Error("印を持たない Load が index.broken を作った")
	}
}

// 「開いている」印を持っているときは、今までどおり自動復旧する。
func TestLoadWithOpenMarkRepairsIndex(t *testing.T) {
	dir, corrupt := newCorruptIndexBinder(t, "index_repair_locked")

	if err := fs.AcquireOpen(dir); err != nil {
		t.Fatalf("AcquireOpen() error: %v", err)
	}
	defer fs.ReleaseOpen(dir)

	f, err := fs.Load(dir)
	if err != nil {
		t.Fatalf("fs.Load() error: %v", err)
	}
	defer f.Close()

	if !f.BrokenIndexBackupExistsForTest() {
		t.Error("印を持つ Load が自動復旧しなかった（index.broken が無い）")
	}
	got, err := os.ReadFile(filepath.Join(dir, ".git", "index"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Equal(got, corrupt) {
		t.Error("印を持つ Load がインデックスを直さなかった")
	}
	if _, err := f.Status(); err != nil {
		t.Errorf("復旧後の Status() error: %v", err)
	}
}

// TestRepairIndexIgnoresNonCorruptError は、sentinel エラー以外（例えば
// 単に空のインデックス相当のケース）では復旧処理が何もしないことを確認する
// 回帰防止テスト。正常なインデックスに対しては HEAD が変化しないことを確認する。
func TestRepairIndexIgnoresNonCorruptError(t *testing.T) {
	f := createFileSystem(t, "index_repair_noop")

	n := newNote("idx3", "idx-alias3")
	if _, err := f.CreateNoteFile(n); err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}
	if err := f.WriteNoteText(n.Id, []byte("# ok\n")); err != nil {
		t.Fatalf("WriteNoteText() error: %v", err)
	}
	if err := f.Commit(fs.M("Create Note", n.Id), fs.NoteFile(n.Id)); err != nil {
		t.Fatalf("Commit() error: %v", err)
	}
	head, err := f.HeadHash()
	if err != nil {
		t.Fatalf("HeadHash() error: %v", err)
	}

	// 破損させずに実行 → 何もしないこと
	f.RepairIndexForTest()

	if f.BrokenIndexBackupExistsForTest() {
		t.Errorf("broken index backup created for a healthy index")
	}
	after, err := f.HeadHash()
	if err != nil {
		t.Fatalf("HeadHash() after no-op repair error: %v", err)
	}
	if after != head {
		t.Errorf("HEAD changed after no-op repair: got %s, want %s", after, head)
	}
}
