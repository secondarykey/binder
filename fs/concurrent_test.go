package fs_test

import (
	"errors"
	"fmt"
	"sync"
	"testing"

	"binder/fs"
)

// Wails のバインディング呼び出しは並行実行されるため、ノート追加の二度押し等で
// 作成＋コミットが同時に走ることがある。かつては .git/index への書き込みが
// 交錯してインデックスが破損した（"index file corrupt"）。
// 作成〜コミットを並行実行しても、エラーにならず全ファイルがコミットされる
// ことを確認する回帰テスト（-race 付きで実行すると排他漏れも検出できる）。
func TestConcurrentCreateCommit(t *testing.T) {

	f, err := fs.NewMemory()
	if err != nil {
		t.Fatalf("NewMemory() error: %v", err)
	}

	const n = 8
	var wg sync.WaitGroup
	errCh := make(chan error, n)

	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()

			name := fmt.Sprintf("note%02d.md", i)

			// 内容の書き込みは行わない（memfs の content.Len() が無ロックのため、
			// ロック外で行われる内容書き込みは -race で billy 側の検出に掛かる。
			// ここで検証したいのは作成＋コミットの並行実行のみ）
			fp, err := f.Create(name)
			if err != nil {
				errCh <- fmt.Errorf("Create(%s) error: %w", name, err)
				return
			}
			if err := fp.Close(); err != nil {
				errCh <- fmt.Errorf("Close(%s) error: %w", name, err)
				return
			}

			// 先行した別のコミットに巻き取られた場合は UpdatedFilesError になる（正常）
			err = f.Commit("add "+name, name)
			if err != nil && !errors.Is(err, fs.UpdatedFilesError) {
				errCh <- fmt.Errorf("Commit(%s) error: %w", name, err)
			}
		}(i)
	}

	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Error(err)
	}

	// 全ファイルが HEAD にコミットされていること
	repo := f.Repo()
	ref, err := repo.Head()
	if err != nil {
		t.Fatalf("Head() error: %v", err)
	}
	c, err := repo.CommitObject(ref.Hash())
	if err != nil {
		t.Fatalf("CommitObject() error: %v", err)
	}
	tree, err := c.Tree()
	if err != nil {
		t.Fatalf("Tree() error: %v", err)
	}
	for i := 0; i < n; i++ {
		name := fmt.Sprintf("note%02d.md", i)
		if _, err := tree.File(name); err != nil {
			t.Errorf("%s is not committed: %v", name, err)
		}
	}

	// 未記録の変更が残っていないこと
	st, err := f.Status()
	if err != nil {
		t.Fatalf("Status() error: %v", err)
	}
	if len(st) != 0 {
		for _, m := range st {
			t.Errorf("uncommitted file remains: %s (%s)", m.Id, m.Typ)
		}
	}
}
