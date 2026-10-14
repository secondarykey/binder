package log

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
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
