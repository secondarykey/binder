package log

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

// recordHandler は受け取った Record を貯める。
type recordHandler struct {
	records *[]slog.Record
}

func (h recordHandler) Enabled(context.Context, slog.Level) bool { return true }
func (h recordHandler) Handle(_ context.Context, r slog.Record) error {
	*h.records = append(*h.records, r)
	return nil
}
func (h recordHandler) WithAttrs([]slog.Attr) slog.Handler { return h }
func (h recordHandler) WithGroup(string) slog.Handler      { return h }

// keepDefault は出し先とレベルをテストのあとで戻す（大域なので t.Parallel と混ぜない）。
func keepDefault(t *testing.T) {
	def := slog.Default()
	lv := GetLevel()
	t.Cleanup(func() {
		slog.SetDefault(def)
		SetLevel(lv)
	})
}

func TestInit(t *testing.T) {
	dir := t.TempDir()
	keepDefault(t)

	logs, err := Init(Options{Dir: dir})
	if err != nil {
		t.Fatalf("Init() error: %+v", err)
	}
	if p := Path(); p != "" {
		t.Errorf("Path() before first write = %q, want empty", p)
	}

	SetLevel(LevelInfo)
	Debugf("hidden %d", 1)
	Warnf("shown %d", 2)
	Info("kv", "k", 3)
	slog.Info("from slog", "k", "v")

	p := Path()
	if filepath.Dir(p) != dir || !strings.HasPrefix(filepath.Base(p), FilePrefix+"_") {
		t.Fatalf("Path() = %q, want %s_*.log under %q", p, FilePrefix, dir)
	}
	// Windows では閉じてからでないと一時フォルダを消せない
	if err := logs.Close(); err != nil {
		t.Fatalf("Close() error: %+v", err)
	}
	if p := Path(); p != "" {
		t.Errorf("Path() after Close = %q, want empty", p)
	}

	buf, err := os.ReadFile(p)
	if err != nil {
		t.Fatalf("ReadFile() error: %+v", err)
	}
	s := string(buf)
	if strings.Contains(s, "hidden") {
		t.Errorf("debug line written at info level:\n%s", s)
	}
	for _, want := range []string{"[WARN  ] shown 2", "[INFO  ] kv k=3", "[INFO  ] from slog k=v"} {
		if !strings.Contains(s, want) {
			t.Errorf("log does not contain %q:\n%s", want, s)
		}
	}
	if GetLevel() != LevelInfo {
		t.Errorf("GetLevel() = %v, want INFO", GetLevel())
	}
}

// フォルダを作れなくても止まらず、error を返して出せる出口（標準エラー出力）で組むこと。
func TestInitBadDir(t *testing.T) {
	keepDefault(t)
	file := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(file, nil, 0o644); err != nil {
		t.Fatal(err)
	}

	logs, err := Init(Options{Dir: file})
	if err == nil {
		t.Fatal("Init() with a file as Dir: want error")
	}
	if logs == nil {
		t.Fatal("Init() returned nil io.Closer")
	}
	defer logs.Close()
	if p := Path(); p != "" {
		t.Errorf("Path() = %q, want empty", p)
	}
}

func TestDefaultDir(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(DirEnv, dir)
	if got := DefaultDir(); got != dir {
		t.Errorf("DefaultDir() = %q, want %q", got, dir)
	}

	t.Setenv(DirEnv, "")
	if got, want := DefaultDir(), filepath.Join(os.TempDir(), "binder"); got != want {
		t.Errorf("DefaultDir() = %q, want %q", got, want)
	}
}

// ファイルとコンソールの両方に組んだときも、出口のレベルで絞られて両方へ出ること。
func TestMultiHandler(t *testing.T) {
	var a, b []slog.Record
	h := multiHandler{recordHandler{&a}, slog.NewTextHandler(nil, &slog.HandlerOptions{Level: LevelError})}
	if !h.Enabled(context.Background(), LevelInfo) {
		t.Error("Enabled(INFO) = false, want true (one sink accepts)")
	}
	h = multiHandler{recordHandler{&a}, recordHandler{&b}}
	l := slog.New(h).With("k", "v")
	l.Info("both")
	if len(a) != 1 || len(b) != 1 {
		t.Fatalf("records = %d, %d, want 1, 1", len(a), len(b))
	}
}

// 記録される呼び出し元は、このパッケージではなく呼んだ側であること。
func TestCallerIsTheCaller(t *testing.T) {
	keepDefault(t)
	var records []slog.Record
	slog.SetDefault(slog.New(recordHandler{&records}))

	Trace("t")
	Debug("d")
	Info("i", "k", 1)
	Notice("n")
	Warn("w")
	Error("e")
	Tracef("t %d", 1)
	Debugf("d %d", 1)
	Infof("i %d", 1)
	Noticef("n %d", 1)
	Warnf("w %d", 1)
	Errorf("e %d", 1)
	PrintStackTrace(os.ErrNotExist)
	PrintTrace(Func("TestCallerIsTheCaller()"))

	if len(records) != 15 {
		t.Fatalf("records = %d, want 15", len(records))
	}
	for _, r := range records {
		// ハンドラ（AddSource・PackageLevelHandler）と同じく CallersFrames で引く。
		// FuncForPC はインライン展開された関数（Trace など）を返すことがあり、ハンドラの見る位置と違う。
		f, _ := runtime.CallersFrames([]uintptr{r.PC}).Next()
		fn := f.Function
		if !strings.HasSuffix(fn, ".TestCallerIsTheCaller") {
			t.Errorf("%q recorded at %s, want the test function", r.Message, fn)
		}
	}
}

// 出さないレベルでは、printf の引数を整形しないこと。
func TestDisabledLevelSkipsFormat(t *testing.T) {
	keepDefault(t)
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: LevelWarn})))

	called := false
	Debugf("%v", stringer(func() string { called = true; return "" }))
	if called {
		t.Error("Debugf formatted its args below the level")
	}
	if Enabled(LevelDebug) {
		t.Error("Enabled(DEBUG) = true, want false")
	}
}

type stringer func() string

func (s stringer) String() string { return s() }

func TestNoneStop(t *testing.T) {
	keepDefault(t)
	var records []slog.Record
	slog.SetDefault(slog.New(recordHandler{&records}))

	func() {
		defer NoneStop()
		panic("boom")
	}()

	if len(records) != 1 || records[0].Level != LevelEmergency || !strings.Contains(records[0].Message, "boom") {
		t.Fatalf("records = %+v, want one emergency with boom", records)
	}
}

// removeOld は今日を含めて keepDays 日分を残し、それより古いログだけを消す。
func TestRemoveOld(t *testing.T) {
	dir := t.TempDir()
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.Local)
	old := now.AddDate(0, 0, -20)
	files := map[string]bool{ // 名前 → 消えるか
		FilePrefix + "_20261015.log":         false, // 今日
		FilePrefix + "_20261006.log":         false, // 10 日目（残す一番古い日）
		FilePrefix + "_20261005.log":         true,  // 11 日目
		"20261001.log":                       true,  // 頭の文字が無かったころのもの
		"memo.log":                           false, // 日付ではない
		FilePrefix + "_memo.log":             false,
		crashPrefix + "20261001-120000.log":  false, // 改名した異常終了の記録
		crashPrefix + crashPIDMark + "1.log": true,  // 中身の無い古い書き出し先
		crashPrefix + crashPIDMark + "2.log": false, // 中身があるもの（次の CatchCrash が改名する）
		crashPrefix + crashPIDMark + "3.log": false, // 中身の無い新しい書き出し先（動いているプロセスのもの）
	}
	for name := range files {
		body := []byte("x")
		if name == crashPrefix+crashPIDMark+"1.log" || name == crashPrefix+crashPIDMark+"3.log" {
			body = nil
		}
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, body, 0o644); err != nil {
			t.Fatal(err)
		}
		if name != crashPrefix+crashPIDMark+"3.log" {
			if err := os.Chtimes(path, old, old); err != nil {
				t.Fatal(err)
			}
		}
	}

	removeOld(dir, 10, true, now)
	for name, removed := range files {
		_, err := os.Stat(filepath.Join(dir, name))
		if removed && !os.IsNotExist(err) {
			t.Errorf("%s が残っている", name)
		}
		if !removed && err != nil {
			t.Errorf("%s が消えた: %v", name, err)
		}
	}

	// legacy でなければ（BINDER_LOG_DIR で指したフォルダ）、頭の文字の無いファイルは触らない
	legacy := filepath.Join(dir, "20261001.log")
	if err := os.WriteFile(legacy, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	removeOld(dir, 10, false, now)
	if _, err := os.Stat(legacy); err != nil {
		t.Errorf("legacy でないのに消えた: %v", err)
	}
}

// Init(KeepDays) は、書き始める前に古いファイルを消す。
func TestInitKeepDays(t *testing.T) {
	keepDefault(t)
	dir := t.TempDir()
	old := filepath.Join(dir, FilePrefix+"_20200101.log")
	if err := os.WriteFile(old, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	c, err := Init(Options{Dir: dir, KeepDays: DefaultKeepDays})
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	if _, err := os.Stat(old); !os.IsNotExist(err) {
		t.Errorf("古いファイルが残っている: %v", err)
	}
}
