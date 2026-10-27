package log

import (
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

// 中身のある書き出し先だけを改名して残すこと（空のものは動いている別のプロセスのもの）。
func TestKeepPreviousCrashes(t *testing.T) {
	dir := t.TempDir()
	if got := keepPreviousCrashes(dir); len(got) != 0 {
		t.Fatalf("ファイルが無いのに %q", got)
	}

	empty := filepath.Join(dir, crashPrefix+crashPIDMark+"1.log")
	crashed := filepath.Join(dir, crashPrefix+crashPIDMark+"2.log")
	sameSecond := filepath.Join(dir, crashPrefix+crashPIDMark+"3.log")
	if err := os.WriteFile(empty, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{crashed, sameSecond} {
		if err := os.WriteFile(p, []byte("panic: boom\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	mod := time.Date(2026, 10, 15, 17, 30, 0, 0, time.Local)
	for _, p := range []string{crashed, sameSecond} {
		if err := os.Chtimes(p, mod, mod); err != nil {
			t.Fatal(err)
		}
	}

	got := keepPreviousCrashes(dir)
	if len(got) != 2 {
		t.Fatalf("改名先 = %q, want 2", got)
	}
	for _, p := range got {
		if !strings.HasPrefix(filepath.Base(p), crashPrefix+"20261015-173000") {
			t.Errorf("改名先 = %q", p)
		}
		if b, err := os.ReadFile(p); err != nil || string(b) != "panic: boom\n" {
			t.Errorf("改名先の中身 = %q, err=%v", b, err)
		}
	}
	if _, err := os.Stat(empty); err != nil {
		t.Errorf("空のファイルを触った: %v", err)
	}
	if got := keepPreviousCrashes(dir); len(got) != 0 {
		t.Errorf("2 回目も返った: %q", got)
	}
}

// 本当に異常終了させて、内容が残ること・次の CatchCrash で前回の記録として返ること・正常に閉じたら書き出し先が消えること。
// テストの実行ファイル自身を環境変数 BINDER_CRASH_TEST_DIR を付けて起動し直し、その中で CatchCrash してから panic させる。
func TestCatchCrash(t *testing.T) {
	if dir := os.Getenv("BINDER_CRASH_TEST_DIR"); dir != "" {
		if _, _, err := CatchCrash(dir); err != nil {
			t.Fatal(err)
		}
		go panic("boom") // goroutine の panic は recover されず、プロセスごと落ちる
		time.Sleep(10 * time.Second)
		return
	}

	dir := t.TempDir()
	cmd := exec.Command(os.Args[0], "-test.run=^TestCatchCrash$")
	cmd.Env = append(os.Environ(), "BINDER_CRASH_TEST_DIR="+dir)
	if err := cmd.Run(); err == nil {
		t.Fatal("異常終了するはず")
	}
	crashed := filepath.Join(dir, crashPrefix+crashPIDMark+strconv.Itoa(cmd.Process.Pid)+".log")
	b, err := os.ReadFile(crashed)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(b), "panic: boom") || !strings.Contains(string(b), "goroutine") {
		t.Fatalf("panic の内容とスタックが残る:\n%s", b)
	}

	// 次の起動にあたる CatchCrash で、前回の記録として改名されて返る
	c, previous, err := CatchCrash(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(previous) != 1 {
		t.Fatalf("前回の記録 = %q", previous)
	}
	if b, _ := os.ReadFile(previous[0]); !strings.Contains(string(b), "panic: boom") {
		t.Fatalf("前回の記録 %q: %s", previous[0], b)
	}

	// 正常に終わるときは書き出し先を消す（Windows では放してからでないと一時フォルダを消せない）
	own := filepath.Join(dir, crashPrefix+crashPIDMark+strconv.Itoa(os.Getpid())+".log")
	if _, err := os.Stat(own); err != nil {
		t.Fatalf("書き出し先が無い: %v", err)
	}
	if err := c.Close(); err != nil {
		t.Fatalf("Close() error: %+v", err)
	}
	if _, err := os.Stat(own); !os.IsNotExist(err) {
		t.Fatalf("Close() のあとも書き出し先が残っている: %v", err)
	}
}

func TestCatchCrashNoDir(t *testing.T) {
	c, _, err := CatchCrash("")
	if err == nil {
		t.Fatal("dir が空: want error")
	}
	if c == nil {
		t.Fatal("io.Closer が nil")
	}
}
