package fs_test

import (
	"binder/fs"
	"binder/test"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// createRepoWithCommits は指定数のコミットを持つリポジトリを作成する。
func createRepoWithCommits(t *testing.T, name string, n int) (*fs.FileSystem, string) {
	t.Helper()

	dir := filepath.Join(test.Dir, name)
	f, err := fs.New(dir)
	if err != nil {
		t.Fatalf("fs.New() error: %v", err)
	}

	file := "test.txt"
	p := filepath.Join(dir, file)

	for i := 0; i < n; i++ {
		content := []byte("commit-" + string(rune('A'+i)))
		if err := os.WriteFile(p, content, 0644); err != nil {
			t.Fatalf("WriteFile() error: %v", err)
		}
		// untracked ファイルは明示的に Add してからコミット
		if err := f.AddFile(file); err != nil {
			t.Fatalf("AddFile(%d) error: %v", i, err)
		}
		if err := f.AutoCommit("Commit "+string(rune('A'+i)), file); err != nil {
			t.Fatalf("AutoCommit(%d) error: %v", i, err)
		}
	}

	return f, p
}

func TestGetCleanupInfo(t *testing.T) {

	f, _ := createRepoWithCommits(t, "cleanup_info", 5)

	// 全コミットより未来の日付 → squash 対象 5、keep 0
	future := time.Now().Add(24 * time.Hour)
	info, err := f.GetCleanupInfo(future)
	if err != nil {
		t.Fatalf("GetCleanupInfo() error: %v", err)
	}

	if info.TotalCommits != 5 {
		t.Errorf("TotalCommits = %d, want 5", info.TotalCommits)
	}
	if info.SquashTarget != 5 {
		t.Errorf("SquashTarget = %d, want 5", info.SquashTarget)
	}
	if info.KeepTarget != 0 {
		t.Errorf("KeepTarget = %d, want 0", info.KeepTarget)
	}

	// 全コミットより過去の日付 → squash 対象 0、keep 5
	past := time.Now().Add(-365 * 24 * time.Hour)
	info2, err := f.GetCleanupInfo(past)
	if err != nil {
		t.Fatalf("GetCleanupInfo() error: %v", err)
	}
	if info2.SquashTarget != 0 {
		t.Errorf("SquashTarget = %d, want 0", info2.SquashTarget)
	}
	if info2.KeepTarget != 5 {
		t.Errorf("KeepTarget = %d, want 5", info2.KeepTarget)
	}
}

func TestSquashHistoryAll(t *testing.T) {

	f, _ := createRepoWithCommits(t, "squash_all", 5)

	// 全コミットを squash（before = 未来）
	future := time.Now().Add(24 * time.Hour)
	_, err := f.SquashHistory(future)
	if err != nil {
		t.Fatalf("SquashHistory() error: %v", err)
	}

	// squash 後はコミット1件（orphan）
	info, err := f.GetCleanupInfo(future)
	if err != nil {
		t.Fatalf("GetCleanupInfo() error: %v", err)
	}
	if info.TotalCommits != 1 {
		t.Errorf("TotalCommits = %d, want 1", info.TotalCommits)
	}
}

func TestSquashHistoryPartial(t *testing.T) {

	dir := filepath.Join(test.Dir, "squash_partial")
	f, err := fs.New(dir)
	if err != nil {
		t.Fatalf("fs.New() error: %v", err)
	}

	file := "test.txt"
	p := filepath.Join(dir, file)

	// 古いコミット3つ
	for i := 0; i < 3; i++ {
		os.WriteFile(p, []byte("old-"+string(rune('A'+i))), 0644)
		f.AddFile(file)
		if err := f.AutoCommit("Old "+string(rune('A'+i)), file); err != nil {
			t.Fatalf("AutoCommit(old %d) error: %v", i, err)
		}
	}

	// カットオフタイム（git のタイムスタンプは秒精度なので 1.1 秒待つ）
	time.Sleep(1100 * time.Millisecond)
	cutoff := time.Now()
	time.Sleep(1100 * time.Millisecond)

	// 新しいコミット3つ
	for i := 0; i < 3; i++ {
		os.WriteFile(p, []byte("new-"+string(rune('A'+i))), 0644)
		f.AddFile(file)
		if err := f.AutoCommit("New "+string(rune('A'+i)), file); err != nil {
			t.Fatalf("AutoCommit(new %d) error: %v", i, err)
		}
	}

	// squash 前: 6 コミット
	future := time.Now().Add(24 * time.Hour)
	infoBefore, _ := f.GetCleanupInfo(future)
	if infoBefore.TotalCommits != 6 {
		t.Fatalf("before squash: TotalCommits = %d, want 6", infoBefore.TotalCommits)
	}

	// cutoff で squash
	_, err = f.SquashHistory(cutoff)
	if err != nil {
		t.Fatalf("SquashHistory() error: %v", err)
	}

	// squash 後: 4 コミット（orphan 1 + keep 3）
	infoAfter, err := f.GetCleanupInfo(future)
	if err != nil {
		t.Fatalf("GetCleanupInfo() error: %v", err)
	}
	if infoAfter.TotalCommits != 4 {
		t.Errorf("after squash: TotalCommits = %d, want 4", infoAfter.TotalCommits)
	}

	// keep 側のコミットメッセージが保持されていること
	commits, _, err := f.GetOverallHistory(10, 0)
	if err != nil {
		t.Fatalf("GetOverallHistory() error: %v", err)
	}
	if len(commits) != 4 {
		t.Fatalf("commit count = %d, want 4", len(commits))
	}
	// 新しい順: New C, New B, New A, Squashed...
	if commits[0].Message != "New C" {
		t.Errorf("commits[0].Message = %q, want %q", commits[0].Message, "New C")
	}
	if commits[1].Message != "New B" {
		t.Errorf("commits[1].Message = %q, want %q", commits[1].Message, "New B")
	}
	if commits[2].Message != "New A" {
		t.Errorf("commits[2].Message = %q, want %q", commits[2].Message, "New A")
	}

	// ファイル内容が最新コミットのものであること
	content, err := os.ReadFile(p)
	if err != nil {
		t.Fatalf("ReadFile() error: %v", err)
	}
	if string(content) != "new-C" {
		t.Errorf("file content = %q, want %q", string(content), "new-C")
	}
}

func TestSquashHistoryNoTarget(t *testing.T) {

	f, _ := createRepoWithCommits(t, "squash_none", 3)

	// 全コミットより過去の日付 → squash 対象なし
	past := time.Now().Add(-365 * 24 * time.Hour)
	_, err := f.SquashHistory(past)
	if err == nil {
		t.Fatal("expected error for no squash target, got nil")
	}
}
