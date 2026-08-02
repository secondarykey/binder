package setup_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"binder/fs"
	"binder/setup"
	"binder/setup/convert"
	"binder/test"

	gogit "github.com/go-git/go-git/v5"
)

// headHasFile は HEAD コミットのツリーに path が含まれるかを返す。
func headHasFile(t *testing.T, dir, path string) bool {
	t.Helper()
	repo, err := gogit.PlainOpen(dir)
	if err != nil {
		t.Fatalf("PlainOpen() error: %v", err)
	}
	head, err := repo.Head()
	if err != nil {
		t.Fatalf("Head() error: %v", err)
	}
	commit, err := repo.CommitObject(head.Hash())
	if err != nil {
		t.Fatalf("CommitObject() error: %v", err)
	}
	tree, err := commit.Tree()
	if err != nil {
		t.Fatalf("Tree() error: %v", err)
	}
	if _, err := tree.File(path); err != nil {
		return false
	}
	return true
}

// 移行前スナップショットに関する回帰テスト。
//
// 背景: go-git の reset --hard は本家 git と異なり未追跡ファイルも削除する。
// 移行失敗時のロールバックでユーザの未記録作業を失わないため、移行前に現状を
// 丸ごとコミットしておく必要がある。一方 go-git の CommitOptions{All:true} は
// 未追跡ファイルを拾わないため、両者を取り違えると
// 「Status() は変更ありと言うのにコミットするものが無い」→ 空コミットエラーで
// 移行が中断し、バインダーが開けなくなる。

func installBinder(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if err := setup.Install(dir, test.LatestVersion, "snapshot", ""); err != nil {
		t.Fatalf("setup.Install() error: %v", err)
	}
	return dir
}

// 未記録のルートファイル（README.md 等）だけがある状態で移行できることを確認する。
// ルートファイルは仕様上、保存時にコミットせず未記録一覧から記録するため、
// この状態は通常運用で普通に発生する。
func TestConvertWithUntrackedRootFile(t *testing.T) {
	dir := installBinder(t)

	readme := filepath.Join(dir, "README.md")
	if err := os.WriteFile(readme, []byte("# hello\n"), 0644); err != nil {
		t.Fatalf("WriteFile() error: %v", err)
	}

	if _, err := convert.Run(dir, test.LatestVersion); err != nil {
		t.Fatalf("convert.Run() error: %v", err)
	}

	// 移行後もルートファイルが残っていること
	if _, err := os.Stat(readme); err != nil {
		t.Errorf("未記録のルートファイルが失われた: %v", err)
	}
}

// スナップショットが未追跡ファイルを実際にコミットしていることを確認する。
// コミットされていないと、移行失敗時の reset --hard で消えてしまう。
func TestCommitSnapshotIncludesUntrackedFile(t *testing.T) {
	dir := installBinder(t)

	readme := filepath.Join(dir, "README.md")
	if err := os.WriteFile(readme, []byte("# hello\n"), 0644); err != nil {
		t.Fatalf("WriteFile() error: %v", err)
	}

	bfs, err := fs.Load(dir)
	if err != nil {
		t.Fatalf("fs.Load() error: %v", err)
	}
	if err := bfs.CommitSnapshot("snapshot"); err != nil {
		t.Fatalf("CommitSnapshot() error: %v", err)
	}

	// コミット済みなら reset --hard しても残る
	head, err := bfs.HeadHash()
	if err != nil {
		t.Fatalf("HeadHash() error: %v", err)
	}
	if err := bfs.ResetHardTo(head.String()); err != nil {
		t.Fatalf("ResetHardTo() error: %v", err)
	}
	if _, err := os.Stat(readme); err != nil {
		t.Errorf("スナップショット後の reset --hard で未追跡ファイルが失われた: %v", err)
	}

	mods, err := bfs.Status()
	if err != nil {
		t.Fatalf("Status() error: %v", err)
	}
	if len(mods) != 0 {
		t.Errorf("スナップショット後に未記録が残っている: %+v", mods)
	}
}

// .gitignore 対象（user_data.enc）をスナップショットが巻き込まないことを確認する。
// 巻き込むと暗号化済みとはいえ認証情報がリポジトリに入り、push で外部へ出る。
func TestCommitSnapshotSkipsIgnoredFile(t *testing.T) {
	dir := installBinder(t)

	secret := filepath.Join(dir, fs.UserFileName)
	if err := os.WriteFile(secret, []byte("secret"), 0644); err != nil {
		t.Fatalf("WriteFile() error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "README.md"), []byte("# hello\n"), 0644); err != nil {
		t.Fatalf("WriteFile() error: %v", err)
	}

	bfs, err := fs.Load(dir)
	if err != nil {
		t.Fatalf("fs.Load() error: %v", err)
	}
	if err := bfs.CommitSnapshot("snapshot"); err != nil {
		t.Fatalf("CommitSnapshot() error: %v", err)
	}

	if headHasFile(t, dir, fs.UserFileName) {
		t.Errorf("%s がスナップショットに含まれている", fs.UserFileName)
	}
	if !headHasFile(t, dir, "README.md") {
		t.Error("README.md がスナップショットに含まれていない")
	}
}

// 変更が無い場合は UpdatedFilesError を返し、呼び出し元が続行できること。
func TestCommitSnapshotNoChanges(t *testing.T) {
	dir := installBinder(t)

	bfs, err := fs.Load(dir)
	if err != nil {
		t.Fatalf("fs.Load() error: %v", err)
	}
	before, err := bfs.HeadHash()
	if err != nil {
		t.Fatalf("HeadHash() error: %v", err)
	}

	err = bfs.CommitSnapshot("snapshot")
	if err == nil {
		t.Fatal("変更が無いのに CommitSnapshot() が成功した")
	}
	if !errors.Is(err, fs.UpdatedFilesError) {
		t.Fatalf("UpdatedFilesError を期待したが: %v", err)
	}

	after, err := bfs.HeadHash()
	if err != nil {
		t.Fatalf("HeadHash() error: %v", err)
	}
	if before != after {
		t.Errorf("空コミットが作られた: %s -> %s", before, after)
	}
}
