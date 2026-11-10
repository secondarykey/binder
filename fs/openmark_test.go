package fs

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

// newOpenMarkDir は .git だけを持つディレクトリを作る（印は .git の存在しか見ない）。
func newOpenMarkDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, ".git"), 0755); err != nil {
		t.Fatal(err)
	}
	return dir
}

func markerExists(dir, name string) bool {
	_, err := os.Stat(filepath.Join(dir, ".git", name))
	return err == nil
}

// lockFromOutside は別のプロセスに見立てて、別のハンドルでロックを試す。
// ロックが取れたら外して true を返す。
func lockFromOutside(t *testing.T, dir string) bool {
	t.Helper()
	f, err := os.OpenFile(filepath.Join(dir, ".git", OpenLockName), os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := tryLock(f); err != nil {
		if errors.Is(err, errLocked) {
			return false
		}
		t.Fatal(err)
	}
	if err := unlock(f); err != nil {
		t.Fatal(err)
	}
	return true
}

func TestOpenMarkAcquireRelease(t *testing.T) {
	dir := newOpenMarkDir(t)

	if err := AcquireOpen(dir); err != nil {
		t.Fatalf("AcquireOpen() error: %v", err)
	}
	if !markerExists(dir, OpenLockName) || !markerExists(dir, OpenInfoName) {
		t.Fatal("印のファイルが作られていない")
	}
	if lockFromOutside(t, dir) {
		t.Fatal("開いている間に外からロックが取れてしまう")
	}

	info, err := ReadOpenInfo(dir)
	if err != nil || info == nil {
		t.Fatalf("ReadOpenInfo() = %v, %v", info, err)
	}
	if info.PID != os.Getpid() {
		t.Errorf("pid = %d, want %d", info.PID, os.Getpid())
	}

	ReleaseOpen(dir)
	if markerExists(dir, OpenLockName) || markerExists(dir, OpenInfoName) {
		t.Fatal("閉じた後に印のファイルが残っている")
	}
}

// 同じプロセスの中では参照カウントで扱い、最後の 1 つで消える
func TestOpenMarkRefCount(t *testing.T) {
	dir := newOpenMarkDir(t)

	if err := AcquireOpen(dir); err != nil {
		t.Fatal(err)
	}
	// パスの書き方が違っても同じバインダーとして数える
	if err := AcquireOpen(filepath.Join(dir, ".")); err != nil {
		t.Fatalf("同じプロセスからの 2 回目の AcquireOpen() error: %v", err)
	}

	ReleaseOpen(dir)
	if !markerExists(dir, OpenLockName) || lockFromOutside(t, dir) {
		t.Fatal("1 つ目を下ろしただけで印が消えた")
	}

	ReleaseOpen(dir)
	if markerExists(dir, OpenLockName) {
		t.Fatal("最後の 1 つを下ろしても印が残っている")
	}

	// 余分な Release は何もしない
	ReleaseOpen(dir)
}

// 別のプロセスがロックを持っていれば開かない
func TestOpenMarkOpenedElsewhere(t *testing.T) {
	dir := newOpenMarkDir(t)

	f, err := os.OpenFile(filepath.Join(dir, ".git", OpenLockName), os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := tryLock(f); err != nil {
		t.Fatal(err)
	}

	err = AcquireOpen(dir)
	if !errors.Is(err, ErrOpenedElsewhere) {
		t.Fatalf("AcquireOpen() = %v, want ErrOpenedElsewhere", err)
	}

	// 失敗した Acquire は数に入らない。相手が閉じれば開ける
	if err := unlock(f); err != nil {
		t.Fatal(err)
	}
	if err := AcquireOpen(dir); err != nil {
		t.Fatalf("相手が閉じた後の AcquireOpen() error: %v", err)
	}
	ReleaseOpen(dir)
}

// クラッシュで残った印（ロックされていないファイル）は開いているとみなさず、上書きする
func TestOpenMarkStale(t *testing.T) {
	dir := newOpenMarkDir(t)

	git := filepath.Join(dir, ".git")
	if err := os.WriteFile(filepath.Join(git, OpenLockName), nil, 0644); err != nil {
		t.Fatal(err)
	}
	stale := `{"pid": 1, "host": "old", "app": "binder.exe", "openedAt": "2026-01-01T00:00:00Z"}`
	if err := os.WriteFile(filepath.Join(git, OpenInfoName), []byte(stale), 0644); err != nil {
		t.Fatal(err)
	}

	if err := AcquireOpen(dir); err != nil {
		t.Fatalf("古い印が残っているときの AcquireOpen() error: %v", err)
	}
	info, err := ReadOpenInfo(dir)
	if err != nil {
		t.Fatal(err)
	}
	if info.PID != os.Getpid() {
		t.Errorf("古い印が書き換わっていない: pid = %d", info.PID)
	}
	ReleaseOpen(dir)
}

// .git の無いディレクトリでは何も作らない
func TestOpenMarkNotRepository(t *testing.T) {
	dir := t.TempDir()

	if err := AcquireOpen(dir); err != nil {
		t.Fatalf("AcquireOpen() error: %v", err)
	}
	if markerExists(dir, OpenLockName) {
		t.Fatal(".git の無いディレクトリに印を作った")
	}
	ReleaseOpen(dir)
}
