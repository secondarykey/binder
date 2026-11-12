package api

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"testing"
	"time"

	"binder"
	"binder/api/json"
	"binder/fs"
	"binder/settings"
	"binder/test"
)

// 「閉じる → 操作 → 開き直す」（runClosed）と、それを通る API のテスト。
// 取り込み・復元・ブランチ・履歴の整理はすべてここを通る。

// TestMain は設定の保存先を一時ディレクトリへ向ける。
// LoadBinder は開いたバインダーを履歴（setting.json）へ保存するので、
// そのままだと利用者の ~/.binder/setting.json を書き換えてしまう。
func TestMain(m *testing.M) {
	home, err := os.MkdirTemp("", "binder_api_test")
	if err != nil {
		panic(err)
	}
	// settings.Home() が読む環境変数（settings のテストと同じ切り替え方）
	if runtime.GOOS == "windows" {
		os.Setenv("USERPROFILE", home)
	} else {
		os.Setenv("HOME", home)
	}
	if err := settings.EnsureDir(); err != nil {
		panic(err)
	}
	// 記録の署名（バインダーごとの設定が無いときに使われる）
	g := settings.Get().Git
	g.Name = "Binder test"
	g.Mail = "binder_test@localhost"

	test.Clean()
	code := m.Run()
	os.RemoveAll(home)
	os.Exit(code)
}

// closedFixture は App で開いたバインダーと、書き換える対象のノート。
type closedFixture struct {
	t      *testing.T
	app    *App
	dir    string
	noteId string
}

// newClosedFixture はバインダーを作り、App に開かせる。
func newClosedFixture(t *testing.T, name string) *closedFixture {
	t.Helper()

	b := test.CreateBinder(t, name)
	if err := b.Close(); err != nil {
		t.Fatalf("Close() error: %v", err)
	}
	dir := filepath.Join(test.Dir, name)

	app := New(test.LatestVersion.String())
	if _, err := app.LoadBinder(dir); err != nil {
		t.Fatalf("LoadBinder() error: %v", err)
	}
	t.Cleanup(func() { app.CloseBinder() })

	f := &closedFixture{t: t, app: app, dir: dir}
	ids := f.noteIds()
	if len(ids) == 0 {
		t.Fatal("バインダーにノートが無い")
	}
	f.noteId = ids[0]
	return f
}

// noteIds はツリーにあるノートの ID を返す。
func (f *closedFixture) noteIds() []string {
	f.t.Helper()
	tree, err := f.app.GetBinderTree()
	if err != nil {
		f.t.Fatalf("GetBinderTree() error: %v", err)
	}
	var ids []string
	var walk func(leaves []*json.Leaf)
	walk = func(leaves []*json.Leaf) {
		for _, l := range leaves {
			if l.Type == "note" {
				ids = append(ids, l.Id)
			}
			walk(l.Children)
		}
	}
	walk(tree.Data)
	return ids
}

// record はノートを書き換えて記録する。
func (f *closedFixture) record(content string) {
	f.t.Helper()
	if err := f.app.SaveNote(f.noteId, content); err != nil {
		f.t.Fatalf("SaveNote() error: %v", err)
	}
	if err := f.app.Commit("note", f.noteId, "edit: "+content); err != nil {
		f.t.Fatalf("Commit() error: %v", err)
	}
}

// note は開いているバインダーから読んだノートの中身を返す。
func (f *closedFixture) note() string {
	f.t.Helper()
	s, err := f.app.OpenNote(f.noteId)
	if err != nil {
		f.t.Fatalf("OpenNote() error: %v", err)
	}
	return s
}

// branch は現在のブランチ名を返す。
func (f *closedFixture) branch() string {
	f.t.Helper()
	name, err := f.app.CurrentBranch()
	if err != nil {
		f.t.Fatalf("CurrentBranch() error: %v", err)
	}
	return name
}

// requireOpen は、開き直したバインダーが使える状態であることを確かめる。
func (f *closedFixture) requireOpen(address string) {
	f.t.Helper()
	if f.app.current == nil {
		f.t.Fatal("開き直したあとの current が nil")
	}
	if address != f.dir {
		f.t.Errorf("Address = %q, want %q", address, f.dir)
	}
	if _, err := f.app.GetBinderTree(); err != nil {
		f.t.Errorf("開き直したあとの GetBinderTree() error: %v", err)
	}
	if !openMarked(f.t, f.dir) {
		f.t.Errorf("開き直したあとに「開いている」印が無い")
	}
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

// 操作の間はバインダーが閉じていて「開いている」印は残り、終われば開き直されること。
func TestRunClosedSuccess(t *testing.T) {
	f := newClosedFixture(t, "closed_success")
	before := f.app.current

	called := false
	res, err := f.app.runClosed(func(repo *binder.Repository) error {
		called = true
		if repo == nil {
			t.Errorf("op に渡る Repository が nil")
		}
		if f.app.current != nil {
			t.Errorf("op の間も current が残っている（閉じていない）")
		}
		if !openMarked(t, f.dir) {
			t.Errorf("op の間に「開いている」印が消えている")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("runClosed() error: %v", err)
	}
	if !called {
		t.Fatal("op が呼ばれていない")
	}
	if res.Status != statusSuccess || res.Message != "" {
		t.Fatalf("res = %+v, want Status success・Message 空", res)
	}
	f.requireOpen(res.Address)
	if f.app.current == before {
		t.Errorf("current が開き直す前と同じ（開き直していない）")
	}

	// 開いたバインダーが履歴の先頭に入る（保存先は TestMain で一時ディレクトリにしてある）
	if h := settings.GetHistories(); len(h) == 0 || h[0] != f.dir {
		t.Errorf("履歴 = %v, want 先頭が %q", h, f.dir)
	}

	// 閉じれば印は消える（操作の間だけ持っていた分が残っていない）
	if err := f.app.CloseBinder(); err != nil {
		t.Fatalf("CloseBinder() error: %v", err)
	}
	if openMarked(t, f.dir) {
		t.Errorf("閉じたあとも「開いている」印が残っている")
	}
}

// 操作が失敗しても開き直し、Status は error になること。
func TestRunClosedOpError(t *testing.T) {
	f := newClosedFixture(t, "closed_op_error")

	opErr := errors.New("op failed")
	res, err := f.app.runClosed(func(repo *binder.Repository) error {
		return opErr
	})
	if err != nil {
		t.Fatalf("runClosed() error: %v", err)
	}
	if res.Status != statusError || res.Message != opErr.Error() {
		t.Fatalf("res = %+v, want Status error・Message %q", res, opErr.Error())
	}
	if !errors.Is(res.opErr, opErr) || res.reloadErr != nil {
		t.Errorf("opErr = %v, reloadErr = %v", res.opErr, res.reloadErr)
	}
	f.requireOpen(res.Address)
}

// 開き直せなければ reload_error になり、バインダーは閉じたままで印も残らないこと。
func TestRunClosedReloadError(t *testing.T) {
	f := newClosedFixture(t, "closed_reload_error")

	dbDir := filepath.Join(f.dir, "db")
	moved := filepath.Join(f.dir, "db_moved")

	res, err := f.app.runClosed(func(repo *binder.Repository) error {
		// DB を退かして、開き直せない状態にする
		return os.Rename(dbDir, moved)
	})
	if err != nil {
		t.Fatalf("runClosed() error: %v", err)
	}
	if res.Status != statusReloadError || res.Message == "" || res.Address != "" {
		t.Fatalf("res = %+v, want Status reload_error・Message あり・Address 空", res)
	}
	if res.reloadErr == nil || res.opErr != nil {
		t.Errorf("opErr = %v, reloadErr = %v", res.opErr, res.reloadErr)
	}
	if f.app.current != nil {
		t.Errorf("開き直せなかったのに current が残っている")
	}
	if openMarked(t, f.dir) {
		t.Errorf("開き直せなかったのに「開いている」印が残っている")
	}

	// 直せばまた開ける
	if err := os.Rename(moved, dbDir); err != nil {
		t.Fatalf("Rename() error: %v", err)
	}
	if _, err := f.app.LoadBinder(f.dir); err != nil {
		t.Fatalf("直したあとの LoadBinder() error: %v", err)
	}
}

// ブランチを作って書き換え、元のブランチへ戻ると中身も戻ること。
func TestCreateAndSwitchBranch(t *testing.T) {
	f := newClosedFixture(t, "closed_branch")
	base := f.branch()
	original := f.note()

	res, err := f.app.CreateBranch("feature")
	if err != nil {
		t.Fatalf("CreateBranch() error: %v", err)
	}
	if res.Status != statusSuccess {
		t.Fatalf("CreateBranch() = %+v", res)
	}
	f.requireOpen(res.Address)
	if cur := f.branch(); cur != "feature" {
		t.Fatalf("CreateBranch 後のブランチ = %q, want feature", cur)
	}

	f.record("feature content\n")

	res, err = f.app.SwitchBranch(base)
	if err != nil {
		t.Fatalf("SwitchBranch() error: %v", err)
	}
	if res.Status != statusSuccess {
		t.Fatalf("SwitchBranch() = %+v", res)
	}
	f.requireOpen(res.Address)
	if cur := f.branch(); cur != base {
		t.Fatalf("SwitchBranch 後のブランチ = %q, want %q", cur, base)
	}
	if got := f.note(); got != original {
		t.Fatalf("元のブランチの中身 = %q, want %q", got, original)
	}

	// 無いブランチへは切り替えられない。バインダーは開き直されている
	res, err = f.app.SwitchBranch("no-such-branch")
	if err != nil {
		t.Fatalf("SwitchBranch(無いブランチ) error: %v", err)
	}
	if res.Status != statusError || res.Message == "" {
		t.Fatalf("SwitchBranch(無いブランチ) = %+v, want Status error", res)
	}
	f.requireOpen(res.Address)
	if cur := f.branch(); cur != base {
		t.Fatalf("失敗後のブランチ = %q, want %q", cur, base)
	}
}

// 未記録の変更があるときは、閉じる前に断ること（バインダーは開いたまま）。
func TestClosedOperationsRequireRecorded(t *testing.T) {
	f := newClosedFixture(t, "closed_require_recorded")
	base := f.branch()

	if _, err := f.app.CreateBranch("feature"); err != nil {
		t.Fatalf("CreateBranch() error: %v", err)
	}
	if _, err := f.app.SwitchBranch(base); err != nil {
		t.Fatalf("SwitchBranch() error: %v", err)
	}
	history, err := f.app.GetOverallHistory(10, 0)
	if err != nil || len(history.Entries) == 0 {
		t.Fatalf("GetOverallHistory() = %+v, %v", history, err)
	}

	// 記録しないまま書き換える
	if err := f.app.SaveNote(f.noteId, "unrecorded\n"); err != nil {
		t.Fatalf("SaveNote() error: %v", err)
	}
	before := f.app.current

	cases := map[string]func() error{
		"SwitchBranch": func() error {
			_, err := f.app.SwitchBranch("feature")
			return err
		},
		"MergeFromLocal": func() error {
			_, err := f.app.MergeFromLocal("feature")
			return err
		},
		"ApplyMergeResolution": func() error {
			_, err := f.app.ApplyMergeResolution(&json.MergeResolution{SourceBranch: "feature"})
			return err
		},
		"RestoreToCommit": func() error {
			_, err := f.app.RestoreToCommit(history.Entries[0].Hash)
			return err
		},
		"SquashHistory": func() error {
			_, err := f.app.SquashHistory(time.Now().Format(time.RFC3339))
			return err
		},
	}
	for name, call := range cases {
		err := call()
		if !errors.Is(err, ErrUncommittedChanges) {
			t.Errorf("%s: err = %v, want ErrUncommittedChanges", name, err)
		}
		var me *MessageError
		if !errors.As(err, &me) {
			t.Errorf("%s: ユーザ向けのエラー（*MessageError）になっていない", name)
		}
		if f.app.current != before {
			t.Errorf("%s: 断ったのにバインダーを開き直している", name)
		}
	}
	if got := f.note(); got != "unrecorded\n" {
		t.Errorf("未記録の中身 = %q, want unrecorded", got)
	}
}

// 取り込み元だけが進んでいれば早送りになり、もう一度取り込むと「すでに最新」になること。
func TestMergeFromLocalFastForward(t *testing.T) {
	f := newClosedFixture(t, "closed_merge_ff")
	base := f.branch()

	if _, err := f.app.CreateBranch("feature"); err != nil {
		t.Fatalf("CreateBranch() error: %v", err)
	}
	f.record("feature content\n")
	if _, err := f.app.SwitchBranch(base); err != nil {
		t.Fatalf("SwitchBranch() error: %v", err)
	}

	res, err := f.app.MergeFromLocal("feature")
	if err != nil {
		t.Fatalf("MergeFromLocal() error: %v", err)
	}
	if res.Status != statusSuccess || len(res.Conflicts) != 0 {
		t.Fatalf("MergeFromLocal() = %+v, want Status success", res)
	}
	f.requireOpen(res.Address)
	if got := f.note(); got != "feature content\n" {
		t.Fatalf("取り込み後の中身 = %q", got)
	}

	res, err = f.app.MergeFromLocal("feature")
	if err != nil {
		t.Fatalf("MergeFromLocal() 2 回目 error: %v", err)
	}
	if res.Status != "uptodate" {
		t.Fatalf("2 回目の Status = %q, want uptodate", res.Status)
	}
	f.requireOpen(res.Address)
}

// 両方が進んでいて同じものを触っていなければ、衝突なしで取り込み、取り込みログのノートができること。
func TestMergeFromLocalDiverged(t *testing.T) {
	f := newClosedFixture(t, "closed_merge_diverged")
	base := f.branch()

	if _, err := f.app.CreateBranch("feature"); err != nil {
		t.Fatalf("CreateBranch() error: %v", err)
	}
	f.record("theirs\n")
	if _, err := f.app.SwitchBranch(base); err != nil {
		t.Fatalf("SwitchBranch() error: %v", err)
	}

	// こちら側は別のノートを足す（ノートの作成はその場で記録される）
	added, err := f.app.EditNote(&json.Note{ParentId: f.noteId, Name: "ours note"}, "")
	if err != nil {
		t.Fatalf("EditNote() error: %v", err)
	}
	if ids, err := f.app.GetModifiedIds(); err != nil || len(ids) != 0 {
		t.Fatalf("取り込み前に未記録が残っている: %v, %v", ids, err)
	}
	notesBefore := f.noteIds()

	res, err := f.app.MergeFromLocal("feature")
	if err != nil {
		t.Fatalf("MergeFromLocal() error: %v", err)
	}
	if res.Status != statusSuccess || len(res.Conflicts) != 0 {
		t.Fatalf("MergeFromLocal() = %+v, want Status success・衝突なし", res)
	}
	f.requireOpen(res.Address)

	// 取り込み元の変更が入り、こちらのノートも残る
	if got := f.note(); got != "theirs\n" {
		t.Fatalf("取り込み後の中身 = %q, want theirs", got)
	}
	notesAfter := f.noteIds()
	if !slices.Contains(notesAfter, added.Id) {
		t.Errorf("こちら側で足したノートが消えている")
	}
	// 取り込みログのノートが 1 つ増える
	if len(notesAfter) != len(notesBefore)+1 {
		t.Errorf("ノートの数 = %d, want %d（取り込みログの分が増える）", len(notesAfter), len(notesBefore)+1)
	}
}

// 両方が同じノートを書き換えていれば衝突を返し、選んだ側で取り込めること。
func TestMergeFromLocalConflict(t *testing.T) {
	f := newClosedFixture(t, "closed_merge_conflict")
	base := f.branch()

	if _, err := f.app.CreateBranch("feature"); err != nil {
		t.Fatalf("CreateBranch() error: %v", err)
	}
	f.record("theirs\n")
	if _, err := f.app.SwitchBranch(base); err != nil {
		t.Fatalf("SwitchBranch() error: %v", err)
	}
	f.record("ours\n")

	res, err := f.app.MergeFromLocal("feature")
	if err != nil {
		t.Fatalf("MergeFromLocal() error: %v", err)
	}
	if res.Status != binder.MergeConflicts {
		t.Fatalf("Status = %q, want %q（%+v）", res.Status, binder.MergeConflicts, res)
	}
	if len(res.Conflicts) != 1 || res.Conflicts[0].Id != f.noteId {
		t.Fatalf("Conflicts = %+v, want 書き換えたノートの 1 件", res.Conflicts)
	}
	if res.OursHash == "" || res.TheirsHash == "" {
		t.Fatalf("OursHash / TheirsHash が空: %+v", res)
	}
	// 衝突の時点では何も取り込んでいない。バインダーは開き直されている
	f.requireOpen(res.Address)
	if got := f.note(); got != "ours\n" {
		t.Fatalf("衝突の時点の中身 = %q, want ours", got)
	}
	notesBefore := f.noteIds()

	applied, err := f.app.ApplyMergeResolution(&json.MergeResolution{
		BaseHash:     res.BaseHash,
		OursHash:     res.OursHash,
		TheirsHash:   res.TheirsHash,
		SourceBranch: "feature",
		Resolutions: []*json.FileResolution{
			{Path: res.Conflicts[0].Path, Resolution: "theirs"},
		},
	})
	if err != nil {
		t.Fatalf("ApplyMergeResolution() error: %v", err)
	}
	if applied.Status != statusSuccess {
		t.Fatalf("ApplyMergeResolution() = %+v, want Status success", applied)
	}
	f.requireOpen(applied.Address)
	if got := f.note(); got != "theirs\n" {
		t.Fatalf("取り込み後の中身 = %q, want theirs", got)
	}
	if n := len(f.noteIds()); n != len(notesBefore)+1 {
		t.Errorf("ノートの数 = %d, want %d（取り込みログの分が増える）", n, len(notesBefore)+1)
	}
}

// 無いブランチからの取り込みは error で返り、バインダーは開き直されること。
func TestMergeFromLocalUnknownBranch(t *testing.T) {
	f := newClosedFixture(t, "closed_merge_unknown")

	res, err := f.app.MergeFromLocal("no-such-branch")
	if err != nil {
		t.Fatalf("MergeFromLocal() error: %v", err)
	}
	if res.Status != statusError || res.Message == "" {
		t.Fatalf("MergeFromLocal() = %+v, want Status error", res)
	}
	f.requireOpen(res.Address)
}

// 履歴から前の記録へ復元すると、中身が戻ること。
func TestRestoreToCommit(t *testing.T) {
	f := newClosedFixture(t, "closed_restore")

	f.record("first\n")
	history, err := f.app.GetOverallHistory(10, 0)
	if err != nil || len(history.Entries) == 0 {
		t.Fatalf("GetOverallHistory() = %+v, %v", history, err)
	}
	first := history.Entries[0].Hash
	f.record("second\n")

	res, err := f.app.RestoreToCommit(first)
	if err != nil {
		t.Fatalf("RestoreToCommit() error: %v", err)
	}
	if res.Status != statusSuccess {
		t.Fatalf("RestoreToCommit() = %+v", res)
	}
	f.requireOpen(res.Address)
	if got := f.note(); got != "first\n" {
		t.Fatalf("復元後の中身 = %q, want first", got)
	}

	// 開いているバインダーと同じディレクトリなら、ByPath も同じ流れを通る
	f.record("third\n")
	res, err = f.app.RestoreToCommitByPath(f.dir, first)
	if err != nil {
		t.Fatalf("RestoreToCommitByPath() error: %v", err)
	}
	if res.Status != statusSuccess {
		t.Fatalf("RestoreToCommitByPath() = %+v", res)
	}
	f.requireOpen(res.Address)
	if got := f.note(); got != "first\n" {
		t.Fatalf("ByPath での復元後の中身 = %q, want first", got)
	}
}

// 履歴の整理（圧縮）と不要データの削除のあとも、バインダーが開き直されて中身が残ること。
func TestSquashHistoryAndRunGC(t *testing.T) {
	f := newClosedFixture(t, "closed_cleanup")

	f.record("first\n")
	f.record("second\n")
	before, err := f.app.GetOverallHistory(100, 0)
	if err != nil {
		t.Fatalf("GetOverallHistory() error: %v", err)
	}

	// 今より後の日時を渡して、ここまでの記録をすべて圧縮の対象にする
	squashed, err := f.app.SquashHistory(time.Now().Add(time.Hour).Format(time.RFC3339))
	if err != nil {
		t.Fatalf("SquashHistory() error: %v", err)
	}
	if squashed.Status != statusSuccess {
		t.Fatalf("SquashHistory() = %+v", squashed)
	}
	f.requireOpen(squashed.Address)
	if got := f.note(); got != "second\n" {
		t.Fatalf("圧縮後の中身 = %q, want second", got)
	}
	after, err := f.app.GetOverallHistory(100, 0)
	if err != nil {
		t.Fatalf("圧縮後の GetOverallHistory() error: %v", err)
	}
	if len(after.Entries) >= len(before.Entries) {
		t.Errorf("記録の数 = %d, want %d より少ない", len(after.Entries), len(before.Entries))
	}

	gc, err := f.app.RunGC()
	if err != nil {
		t.Fatalf("RunGC() error: %v", err)
	}
	if gc == nil {
		t.Fatal("RunGC() の結果が nil")
	}
	f.requireOpen(f.dir)
	if got := f.note(); got != "second\n" {
		t.Fatalf("不要データの削除後の中身 = %q, want second", got)
	}
}

// バインダーを開いていない状態での、ブランチの一覧・切替と復元（ByPath）。
// 書き込む間だけ「開いている」印を立て、終われば外すこと。
func TestByPathWithoutOpenBinder(t *testing.T) {
	f := newClosedFixture(t, "closed_by_path")
	base := f.branch()

	f.record("base content\n")
	history, err := f.app.GetOverallHistory(10, 0)
	if err != nil || len(history.Entries) == 0 {
		t.Fatalf("GetOverallHistory() = %+v, %v", history, err)
	}
	baseHash := history.Entries[0].Hash

	if _, err := f.app.CreateBranch("feature"); err != nil {
		t.Fatalf("CreateBranch() error: %v", err)
	}
	f.record("feature content\n")

	if err := f.app.CloseBinder(); err != nil {
		t.Fatalf("CloseBinder() error: %v", err)
	}
	notePath := filepath.Join(f.dir, "notes", f.noteId+".md")
	read := func() string {
		t.Helper()
		data, err := os.ReadFile(notePath)
		if err != nil {
			t.Fatalf("ReadFile() error: %v", err)
		}
		return string(data)
	}

	branches, err := f.app.ListBranchesByPath(f.dir)
	if err != nil {
		t.Fatalf("ListBranchesByPath() error: %v", err)
	}
	if !slices.Contains(branches, "feature") || !slices.Contains(branches, base) {
		t.Fatalf("ListBranchesByPath() = %v, want feature と %s を含む", branches, base)
	}
	if cur, err := f.app.CurrentBranchByPath(f.dir); err != nil || cur != "feature" {
		t.Fatalf("CurrentBranchByPath() = %q, %v, want feature", cur, err)
	}

	page, err := f.app.GetOverallHistoryByPath(f.dir, 10, 0)
	if err != nil || len(page.Entries) == 0 {
		t.Fatalf("GetOverallHistoryByPath() = %+v, %v", page, err)
	}
	if _, err := f.app.GetCommitFilesByPath(f.dir, page.Entries[0].Hash); err != nil {
		t.Fatalf("GetCommitFilesByPath() error: %v", err)
	}

	// 未記録の変更は捨ててから切り替える（移行に失敗したあとを想定）
	if err := os.WriteFile(notePath, []byte("dirty"), 0644); err != nil {
		t.Fatalf("WriteFile() error: %v", err)
	}
	res, err := f.app.SwitchBranchByPath(f.dir, base)
	if err != nil {
		t.Fatalf("SwitchBranchByPath() error: %v", err)
	}
	if res.Status != statusSuccess {
		t.Fatalf("SwitchBranchByPath() = %+v", res)
	}
	if got := read(); got != "base content\n" {
		t.Fatalf("切替後の中身 = %q, want base content", got)
	}
	if f.app.current != nil {
		t.Errorf("ByPath の操作でバインダーが開かれている")
	}
	if openMarked(t, f.dir) {
		t.Errorf("SwitchBranchByPath のあとも「開いている」印が残っている")
	}

	res, err = f.app.SwitchBranchByPath(f.dir, "no-such-branch")
	if err != nil {
		t.Fatalf("SwitchBranchByPath(無いブランチ) error: %v", err)
	}
	if res.Status != statusError || res.Message == "" {
		t.Fatalf("SwitchBranchByPath(無いブランチ) = %+v, want Status error", res)
	}

	if _, err := f.app.SwitchBranchByPath(f.dir, "feature"); err != nil {
		t.Fatalf("SwitchBranchByPath(feature) error: %v", err)
	}
	res, err = f.app.RestoreToCommitByPath(f.dir, baseHash)
	if err != nil {
		t.Fatalf("RestoreToCommitByPath() error: %v", err)
	}
	if res.Status != statusSuccess {
		t.Fatalf("RestoreToCommitByPath() = %+v", res)
	}
	if got := read(); got != "base content\n" {
		t.Fatalf("復元後の中身 = %q, want base content", got)
	}
	if openMarked(t, f.dir) {
		t.Errorf("RestoreToCommitByPath のあとも「開いている」印が残っている")
	}
}
