package binder_test

import (
	"binder"
	"binder/fs"
	"binder/internal"
	"binder/test"

	"os"
	"path/filepath"
	"slices"
	"testing"
)

// repoFixture は「閉じたバインダー」を用意し、ノートを書き換えて記録する手段を持つ。
type repoFixture struct {
	t      *testing.T
	dir    string
	noteId string
}

func newRepoFixture(t *testing.T, name string) *repoFixture {
	t.Helper()
	b := test.CreateBinder(t, name)
	id := getFirstNoteId(t, b)
	if err := b.Close(); err != nil {
		t.Fatalf("Close() error: %v", err)
	}
	return &repoFixture{t: t, dir: filepath.Join(test.Dir, name), noteId: id}
}

// open は閉じたリポジトリを開く。
func (f *repoFixture) open() *binder.Repository {
	f.t.Helper()
	r, err := binder.OpenRepository(f.dir)
	if err != nil {
		f.t.Fatalf("OpenRepository() error: %v", err)
	}
	return r
}

// record はバインダーを開いてノートを書き換え、記録して閉じる。
func (f *repoFixture) record(content string) {
	f.t.Helper()
	b, err := binder.Load(f.dir)
	if err != nil {
		f.t.Fatalf("Load() error: %v", err)
	}
	defer b.Close()
	if err := b.SaveNote(f.noteId, []byte(content)); err != nil {
		f.t.Fatalf("SaveNote() error: %v", err)
	}
	if err := b.CommitFiles("edit: "+content, b.ToFile("note", f.noteId)); err != nil {
		f.t.Fatalf("CommitFiles() error: %v", err)
	}
}

// noteContent は作業ツリーのノートの中身を返す。
func (f *repoFixture) noteContent() string {
	f.t.Helper()
	data, err := os.ReadFile(filepath.Join(f.dir, "notes", f.noteId+".md"))
	if err != nil {
		f.t.Fatalf("ReadFile() error: %v", err)
	}
	return string(data)
}

// mergeAppVersion は、バインダーを作ったのと同じバージョン（移行が要らない）を返す。
func mergeAppVersion(t *testing.T, dir string) *internal.Version {
	t.Helper()
	meta, err := fs.LoadMeta(dir)
	if err != nil {
		t.Fatalf("LoadMeta() error: %v", err)
	}
	v, err := internal.NewVersion(meta.Version)
	if err != nil {
		t.Fatalf("NewVersion(%q) error: %v", meta.Version, err)
	}
	return v
}

// openMarked は「開いている」印があるかを返す。
func openMarked(t *testing.T, dir string) bool {
	t.Helper()
	info, err := fs.ReadOpenInfo(dir)
	if err != nil {
		t.Fatalf("ReadOpenInfo() error: %v", err)
	}
	return info != nil
}

// ブランチを作って切り替え、元のブランチへ戻れること。
func TestRepositoryBranches(t *testing.T) {
	f := newRepoFixture(t, "repo_branches")

	r := f.open()
	base, err := r.CurrentBranch()
	if err != nil {
		t.Fatalf("CurrentBranch() error: %v", err)
	}

	if err := r.CreateBranch("feature"); err != nil {
		t.Fatalf("CreateBranch() error: %v", err)
	}
	if cur, _ := f.open().CurrentBranch(); cur != "feature" {
		t.Fatalf("CreateBranch 後のブランチ = %q, want feature", cur)
	}

	branches, err := f.open().ListBranches()
	if err != nil {
		t.Fatalf("ListBranches() error: %v", err)
	}
	if !slices.Contains(branches, "feature") || !slices.Contains(branches, base) {
		t.Fatalf("ListBranches() = %v, want feature と %s を含む", branches, base)
	}

	if err := f.open().SwitchBranch(base); err != nil {
		t.Fatalf("SwitchBranch() error: %v", err)
	}
	if cur, _ := f.open().CurrentBranch(); cur != base {
		t.Fatalf("SwitchBranch 後のブランチ = %q, want %q", cur, base)
	}
}

// DiscardChanges が未記録の変更を捨てること（移行失敗後のブランチ切替の前処理）。
func TestRepositoryDiscardChanges(t *testing.T) {
	f := newRepoFixture(t, "repo_discard")
	before := f.noteContent()

	p := filepath.Join(f.dir, "notes", f.noteId+".md")
	if err := os.WriteFile(p, []byte("dirty"), 0644); err != nil {
		t.Fatalf("WriteFile() error: %v", err)
	}

	if err := f.open().DiscardChanges(); err != nil {
		t.Fatalf("DiscardChanges() error: %v", err)
	}
	if got := f.noteContent(); got != before {
		t.Fatalf("DiscardChanges 後の中身 = %q, want %q", got, before)
	}
}

// LockRepository は「開いている」印を立て、Close で外すこと。
func TestLockRepository(t *testing.T) {
	f := newRepoFixture(t, "repo_lock")

	r, err := binder.LockRepository(f.dir)
	if err != nil {
		t.Fatalf("LockRepository() error: %v", err)
	}
	if !openMarked(t, f.dir) {
		t.Errorf("LockRepository 後に「開いている」印が無い")
	}
	r.Close()
	if openMarked(t, f.dir) {
		t.Errorf("Close 後も「開いている」印が残っている")
	}
	// 2 回呼んでも壊れない
	r.Close()
}

// 取り込み元だけが進んでいれば早送りになること。
func TestRepositoryMergeFastForward(t *testing.T) {
	f := newRepoFixture(t, "repo_merge_ff")

	base, _ := f.open().CurrentBranch()
	if err := f.open().CreateBranch("feature"); err != nil {
		t.Fatalf("CreateBranch() error: %v", err)
	}
	f.record("feature content\n")
	if err := f.open().SwitchBranch(base); err != nil {
		t.Fatalf("SwitchBranch() error: %v", err)
	}

	out, err := f.open().Merge(binder.MergeSource{LocalBranch: "feature"}, mergeAppVersion(t, f.dir))
	if err != nil {
		t.Fatalf("Merge() error: %v", err)
	}
	// 早送りは fs の値がそのまま返る。分岐を取り込んだ MergeApplied とは別物
	if out.Status != "success" || out.Analysis != nil || out.Log != nil {
		t.Fatalf("Merge() = %+v, want 早送り（Status success・Analysis と Log は nil）", out)
	}
	if got := f.noteContent(); got != "feature content\n" {
		t.Fatalf("取り込み後の中身 = %q", got)
	}

	// もう一度取り込むと「すでに最新」
	out, err = f.open().Merge(binder.MergeSource{LocalBranch: "feature"}, mergeAppVersion(t, f.dir))
	if err != nil {
		t.Fatalf("Merge() 2 回目 error: %v", err)
	}
	if out.Status != "uptodate" {
		t.Fatalf("2 回目の Status = %q, want uptodate", out.Status)
	}
}

// 両方が同じノートを書き換えていれば衝突になり、選んだ側で取り込めること。
func TestRepositoryMergeConflict(t *testing.T) {
	f := newRepoFixture(t, "repo_merge_conflict")

	base, _ := f.open().CurrentBranch()
	if err := f.open().CreateBranch("feature"); err != nil {
		t.Fatalf("CreateBranch() error: %v", err)
	}
	f.record("theirs\n")
	if err := f.open().SwitchBranch(base); err != nil {
		t.Fatalf("SwitchBranch() error: %v", err)
	}
	f.record("ours\n")

	src := binder.MergeSource{LocalBranch: "feature"}
	out, err := f.open().Merge(src, mergeAppVersion(t, f.dir))
	if err != nil {
		t.Fatalf("Merge() error: %v", err)
	}
	if out.Status != binder.MergeConflicts {
		t.Fatalf("Status = %q, want %q", out.Status, binder.MergeConflicts)
	}
	if len(out.Analysis.Conflicts) != 1 {
		t.Fatalf("Conflicts = %+v, want 1 件", out.Analysis.Conflicts)
	}
	// 衝突の時点では何も書き込んでいない
	if got := f.noteContent(); got != "ours\n" {
		t.Fatalf("衝突の時点の中身 = %q, want ours", got)
	}

	conflict := out.Analysis.Conflicts[0]
	mergeLog, err := f.open().ApplyMergeResolution(src,
		out.Analysis.OursHash.String(), out.Analysis.TheirsHash.String(),
		[]fs.FileResolution{{Path: conflict.Path, Resolution: "theirs"}})
	if err != nil {
		t.Fatalf("ApplyMergeResolution() error: %v", err)
	}
	if got := f.noteContent(); got != "theirs\n" {
		t.Fatalf("取り込み後の中身 = %q, want theirs", got)
	}
	if mergeLog == nil || mergeLog.SourceBranch != "feature" {
		t.Fatalf("mergeLog = %+v, want SourceBranch feature", mergeLog)
	}

	// 開き直して後始末（取り込みログのノートができ、現在のブランチが入る）
	b, err := binder.Load(f.dir)
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	defer b.Close()
	b.FinishMerge(mergeLog)
	if mergeLog.LocalBranch != base {
		t.Errorf("mergeLog.LocalBranch = %q, want %q", mergeLog.LocalBranch, base)
	}
}

// 開いていないバインダーの履歴とファイル一覧が取れること。
func TestHistoryByPath(t *testing.T) {
	f := newRepoFixture(t, "repo_history_by_path")
	f.record("history\n")

	commits, _, err := binder.OverallHistoryByPath(f.dir, 10, 0)
	if err != nil {
		t.Fatalf("OverallHistoryByPath() error: %v", err)
	}
	if len(commits) == 0 {
		t.Fatalf("履歴が空")
	}

	entries, err := binder.CommitFileEntriesByPath(f.dir, commits[0].Hash)
	if err != nil {
		t.Fatalf("CommitFileEntriesByPath() error: %v", err)
	}
	found := false
	for _, e := range entries {
		if e.Typ == "note" && e.Id == f.noteId {
			found = true
			// バインダーとして開けたので、名前は ID ではなくノート名になる
			if e.Name == "" {
				t.Errorf("ノートの名前が空")
			}
		}
	}
	if !found {
		t.Fatalf("書き換えたノートが一覧に無い: %+v", entries)
	}
}
