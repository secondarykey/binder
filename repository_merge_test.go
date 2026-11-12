package binder_test

import (
	"binder"
	"binder/api/json"
	"binder/fs"

	encjson "encoding/json"
	"path/filepath"
	"testing"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
)

// リモートからの取り込みと、取り込み元のバージョンの確認・その場での移行のテスト。
// ローカルブランチからの取り込み（早送り・衝突）は repository_test.go。

// testUserInfo は、ローカルのリモート（ディレクトリ）への送受信に渡す認証情報。
// ディレクトリ相手では使われないが、認証の種類が空だとエラーになるので入れておく。
func testUserInfo() *json.UserInfo {
	return &json.UserInfo{Name: "Binder test", Email: "binder_test@localhost", AuthType: string(fs.AuthBasic)}
}

// load はバインダーを開く（閉じるのは呼び出し側）。
func (f *repoFixture) load() *binder.Binder {
	f.t.Helper()
	b, err := binder.Load(f.dir)
	if err != nil {
		f.t.Fatalf("Load() error: %v", err)
	}
	return b
}

// gitRepo は go-git でリポジトリを開く（参照を直接見る・消すため）。
func (f *repoFixture) gitRepo() *git.Repository {
	f.t.Helper()
	repo, err := git.PlainOpen(f.dir)
	if err != nil {
		f.t.Fatalf("PlainOpen() error: %v", err)
	}
	return repo
}

// branchHash はローカルブランチの先頭のハッシュを返す。
func (f *repoFixture) branchHash(name string) plumbing.Hash {
	f.t.Helper()
	ref, err := f.gitRepo().Reference(plumbing.NewBranchReferenceName(name), true)
	if err != nil {
		f.t.Fatalf("Reference(%s) error: %v", name, err)
	}
	return ref.Hash()
}

// headHash は HEAD のハッシュを返す。
func (f *repoFixture) headHash() plumbing.Hash {
	f.t.Helper()
	head, err := f.gitRepo().Head()
	if err != nil {
		f.t.Fatalf("Head() error: %v", err)
	}
	return head.Hash()
}

// currentBranch は現在のブランチ名を返す。
func (f *repoFixture) currentBranch() string {
	f.t.Helper()
	name, err := f.open().CurrentBranch()
	if err != nil {
		f.t.Fatalf("CurrentBranch() error: %v", err)
	}
	return name
}

// addRemote は bare リポジトリを作り、バインダーのリモート origin にする（ネットワークは使わない）。
func (f *repoFixture) addRemote() {
	f.t.Helper()
	remoteDir, err := filepath.Abs(f.dir + "_remote.git")
	if err != nil {
		f.t.Fatalf("Abs() error: %v", err)
	}
	if _, err := git.PlainInit(remoteDir, true); err != nil {
		f.t.Fatalf("PlainInit() error: %v", err)
	}
	b := f.load()
	defer b.Close()
	if err := b.CreateRemote("origin", remoteDir); err != nil {
		f.t.Fatalf("CreateRemote() error: %v", err)
	}
}

// fetch はリモートのブランチを取ってくる（取り込みの前に api が行うこと）。
func (f *repoFixture) fetch(branch string) {
	f.t.Helper()
	b := f.load()
	defer b.Close()
	err := b.Fetch("origin", branch, &fs.UserInfo{AuthType: fs.AuthBasic})
	if err != nil {
		f.t.Fatalf("Fetch() error: %v", err)
	}
}

// pushFeature は feature ブランチを作って content を記録し、リモートへ送って、元のブランチへ戻る。
// ローカルに残る feature の参照は消すので、取り込めるのはリモートから取ってきたものだけになる。
func (f *repoFixture) pushFeature(content string) {
	f.t.Helper()
	base := f.currentBranch()
	if err := f.open().CreateBranch("feature"); err != nil {
		f.t.Fatalf("CreateBranch() error: %v", err)
	}
	f.record(content)

	b := f.load()
	err := b.Push("origin", testUserInfo(), false)
	b.Close()
	if err != nil {
		f.t.Fatalf("Push() error: %v", err)
	}

	if err := f.open().SwitchBranch(base); err != nil {
		f.t.Fatalf("SwitchBranch() error: %v", err)
	}
	// 送信はリモート追跡の参照（refs/remotes/origin/feature）も進めるので、それも消す
	for _, ref := range []plumbing.ReferenceName{
		plumbing.NewBranchReferenceName("feature"),
		plumbing.NewRemoteReferenceName("origin", "feature"),
	} {
		if err := f.gitRepo().Storer.RemoveReference(ref); err != nil {
			f.t.Fatalf("RemoveReference(%s) error: %v", ref, err)
		}
	}
}

// リモートから取ってきたブランチを早送りで取り込めること。取ってくる前は取り込めないこと。
func TestRepositoryMergeRemoteFastForward(t *testing.T) {
	f := newRepoFixture(t, "repo_merge_remote_ff")
	f.addRemote()
	f.pushFeature("remote content\n")

	src := binder.MergeSource{RemoteName: "origin", RemoteBranch: "feature"}
	ver := mergeAppVersion(t, f.dir)

	// まだ取ってきていない
	if _, err := f.open().Merge(src, ver); err == nil {
		t.Fatalf("取ってくる前の Merge() がエラーにならない")
	}

	f.fetch("feature")
	out, err := f.open().Merge(src, ver)
	if err != nil {
		t.Fatalf("Merge() error: %v", err)
	}
	if out.Status != "success" || out.Analysis != nil {
		t.Fatalf("Merge() = %+v, want 早送り（Status success）", out)
	}
	if got := f.noteContent(); got != "remote content\n" {
		t.Fatalf("取り込み後の中身 = %q", got)
	}

	out, err = f.open().Merge(src, ver)
	if err != nil {
		t.Fatalf("Merge() 2 回目 error: %v", err)
	}
	if out.Status != "uptodate" {
		t.Fatalf("2 回目の Status = %q, want uptodate", out.Status)
	}
}

// リモートと両方が同じノートを書き換えていれば衝突になり、選んだ側で取り込めること。
// 取り込みログには取り込み元のリモートが入る。
func TestRepositoryMergeRemoteConflict(t *testing.T) {
	f := newRepoFixture(t, "repo_merge_remote_conflict")
	f.addRemote()
	f.pushFeature("theirs\n")
	f.record("ours\n")
	f.fetch("feature")

	src := binder.MergeSource{RemoteName: "origin", RemoteBranch: "feature"}
	out, err := f.open().Merge(src, mergeAppVersion(t, f.dir))
	if err != nil {
		t.Fatalf("Merge() error: %v", err)
	}
	if out.Status != binder.MergeConflicts || len(out.Analysis.Conflicts) != 1 {
		t.Fatalf("Merge() = %+v, want 衝突 1 件", out)
	}
	if got := f.noteContent(); got != "ours\n" {
		t.Fatalf("衝突の時点の中身 = %q, want ours", got)
	}

	mergeLog, err := f.open().ApplyMergeResolution(src,
		out.Analysis.OursHash.String(), out.Analysis.TheirsHash.String(),
		[]fs.FileResolution{{Path: out.Analysis.Conflicts[0].Path, Resolution: "theirs"}})
	if err != nil {
		t.Fatalf("ApplyMergeResolution() error: %v", err)
	}
	if got := f.noteContent(); got != "theirs\n" {
		t.Fatalf("取り込み後の中身 = %q, want theirs", got)
	}
	if mergeLog == nil || mergeLog.RemoteName != "origin" || mergeLog.RemoteBranch != "feature" || mergeLog.SourceBranch != "" {
		t.Fatalf("mergeLog = %+v, want 取り込み元が origin/feature", mergeLog)
	}
}

// featureWithVersion は、binder.json のバージョンが version の取り込み元（feature ブランチ）を作り、
// 元のブランチへ戻る（別のバージョンのアプリで作られた取り込み元を作るため）。
func (f *repoFixture) featureWithVersion(version, content string) {
	f.t.Helper()
	base := f.currentBranch()
	if err := f.open().CreateBranch("feature"); err != nil {
		f.t.Fatalf("CreateBranch() error: %v", err)
	}
	f.record(content)

	meta, err := fs.LoadMeta(f.dir)
	if err != nil {
		f.t.Fatalf("LoadMeta() error: %v", err)
	}
	meta.Version = version
	if err := fs.SaveMeta(f.dir, meta); err != nil {
		f.t.Fatalf("SaveMeta() error: %v", err)
	}
	bfs, err := fs.Load(f.dir)
	if err != nil {
		f.t.Fatalf("fs.Load() error: %v", err)
	}
	if err := bfs.AddFile(fs.BinderMetaFile); err != nil {
		f.t.Fatalf("AddFile() error: %v", err)
	}
	if err := bfs.AutoCommit("version: "+version, fs.BinderMetaFile); err != nil {
		f.t.Fatalf("AutoCommit() error: %v", err)
	}

	if err := f.open().SwitchBranch(base); err != nil {
		f.t.Fatalf("SwitchBranch() error: %v", err)
	}
}

// versionAt は、コミットにある binder.json のバージョンを返す。
func (f *repoFixture) versionAt(hash plumbing.Hash) string {
	f.t.Helper()
	commit, err := f.gitRepo().CommitObject(hash)
	if err != nil {
		f.t.Fatalf("CommitObject() error: %v", err)
	}
	file, err := commit.File(fs.BinderMetaFile)
	if err != nil {
		f.t.Fatalf("File(%s) error: %v", fs.BinderMetaFile, err)
	}
	text, err := file.Contents()
	if err != nil {
		f.t.Fatalf("Contents() error: %v", err)
	}
	var meta fs.BinderMeta
	if err := encjson.Unmarshal([]byte(text), &meta); err != nil {
		f.t.Fatalf("Unmarshal() error: %v", err)
	}
	return meta.Version
}

// 取り込み元がアプリより新しければ、何も書き込まずに MergeVersionNewer を返すこと。
func TestRepositoryMergeSourceNewer(t *testing.T) {
	f := newRepoFixture(t, "repo_merge_newer")
	ver := mergeAppVersion(t, f.dir)
	base := f.currentBranch()
	f.featureWithVersion("999.0.0", "newer\n")
	before, head := f.noteContent(), f.headHash()

	out, err := f.open().Merge(binder.MergeSource{LocalBranch: "feature"}, ver)
	if err != nil {
		t.Fatalf("Merge() error: %v", err)
	}
	if out.Status != binder.MergeVersionNewer {
		t.Fatalf("Status = %q, want %q", out.Status, binder.MergeVersionNewer)
	}
	if got := f.noteContent(); got != before {
		t.Errorf("中身が変わっている: %q", got)
	}
	if cur := f.currentBranch(); cur != base || f.headHash() != head {
		t.Errorf("ブランチか HEAD が動いている: %s %s", cur, f.headHash())
	}
}

// 取り込み元が移行できる最小のバージョンより古ければ、何も書き込まずにエラーを返すこと。
func TestRepositoryMergeSourceTooOld(t *testing.T) {
	f := newRepoFixture(t, "repo_merge_too_old")
	ver := mergeAppVersion(t, f.dir)
	base := f.currentBranch()
	f.featureWithVersion("0.1.0", "old\n")
	before, head := f.noteContent(), f.headHash()

	if _, err := f.open().Merge(binder.MergeSource{LocalBranch: "feature"}, ver); err == nil {
		t.Fatalf("古すぎる取り込み元の Merge() がエラーにならない")
	}
	if got := f.noteContent(); got != before {
		t.Errorf("中身が変わっている: %q", got)
	}
	if cur := f.currentBranch(); cur != base || f.headHash() != head {
		t.Errorf("ブランチか HEAD が動いている: %s %s", cur, f.headHash())
	}
}

// 取り込み元が古いバージョンなら、その場で移行してから取り込むこと。
// 移行のあとは元のブランチへ戻り、取り込み元のブランチ自体は動かさない。
func TestRepositoryMergeSourceMigrated(t *testing.T) {
	f := newRepoFixture(t, "repo_merge_migrated")
	ver := mergeAppVersion(t, f.dir)
	base := f.currentBranch()
	// 0.10.2 の移行だけが掛かるバージョン
	f.featureWithVersion("0.10.1", "migrated\n")
	f.record("ours\n")
	featureBefore := f.branchHash("feature")

	src := binder.MergeSource{LocalBranch: "feature"}
	out, err := f.open().Merge(src, ver)
	if err != nil {
		t.Fatalf("Merge() error: %v", err)
	}
	// 同じノートを両方が書き換えているので衝突。取り込み元は移行後のコミットになる
	if out.Status != binder.MergeConflicts {
		t.Fatalf("Status = %q, want %q（%+v）", out.Status, binder.MergeConflicts, out)
	}
	if out.Analysis.TheirsHash == featureBefore {
		t.Errorf("TheirsHash が移行前のコミットのまま")
	}
	if got := f.versionAt(out.Analysis.TheirsHash); got != ver.String() {
		t.Errorf("移行後の取り込み元のバージョン = %q, want %q", got, ver.String())
	}

	// 移行のあとは元のブランチへ戻り、まだ何も取り込んでいない
	if cur := f.currentBranch(); cur != base {
		t.Fatalf("移行のあとのブランチ = %q, want %q", cur, base)
	}
	if got := f.noteContent(); got != "ours\n" {
		t.Fatalf("衝突の時点の中身 = %q, want ours", got)
	}
	if f.branchHash("feature") != featureBefore {
		t.Errorf("取り込み元のブランチが動いている")
	}

	var resolutions []fs.FileResolution
	for _, c := range out.Analysis.Conflicts {
		resolutions = append(resolutions, fs.FileResolution{Path: c.Path, Resolution: "theirs"})
	}
	if _, err := f.open().ApplyMergeResolution(src,
		out.Analysis.OursHash.String(), out.Analysis.TheirsHash.String(), resolutions); err != nil {
		t.Fatalf("ApplyMergeResolution() error: %v", err)
	}
	if got := f.noteContent(); got != "migrated\n" {
		t.Fatalf("取り込み後の中身 = %q, want migrated", got)
	}

	// 取り込んだあとのバインダーはアプリのバージョンのままで、未記録の変更なしで開ける
	after, err := fs.LoadMeta(f.dir)
	if err != nil {
		t.Fatalf("LoadMeta() error: %v", err)
	}
	if after.Version != ver.String() {
		t.Errorf("取り込み後のバージョン = %q, want %q", after.Version, ver.String())
	}
	b := f.load()
	defer b.Close()
	if ids, err := b.GetModifiedIds(); err != nil || len(ids) != 0 {
		t.Errorf("取り込み後に未記録の変更がある: %v, %v", ids, err)
	}
}
