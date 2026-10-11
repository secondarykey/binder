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

func keepDefault(t *testing.T) {
	def := slog.Default()
	lv := GetLevel()
	t.Cleanup(func() {
		Close()
		slog.SetDefault(def)
		SetLevel(lv)
	})
}

func TestInit(t *testing.T) {
	tmp := t.TempDir()
	// os.TempDir() が見る環境変数（Windows は TMP / TEMP、それ以外は TMPDIR）
	t.Setenv("TMP", tmp)
	t.Setenv("TEMP", tmp)
	t.Setenv("TMPDIR", tmp)
	keepDefault(t)

	if _, err := Init(); err != nil {
		t.Fatalf("Init() error: %+v", err)
	}
	if p := Path(); p != "" {
		t.Errorf("Path() before first write = %q, want empty", p)
	}

	SetLevel(slog.LevelInfo)
	Debug("hidden %d", 1)
	Warn("shown %d", 2)
	slog.Info("from slog", "k", "v")

	p := Path()
	if filepath.Dir(p) != filepath.Join(tmp, "binder") {
		t.Fatalf("Path() = %q, want under %q", p, filepath.Join(tmp, "binder"))
	}
	buf, err := os.ReadFile(p)
	if err != nil {
		t.Fatalf("ReadFile() error: %+v", err)
	}
	s := string(buf)
	if strings.Contains(s, "hidden") {
		t.Errorf("debug line written at info level:\n%s", s)
	}
	for _, want := range []string{"[WARN  ] shown 2", "[INFO  ] from slog k=v"} {
		if !strings.Contains(s, want) {
			t.Errorf("log does not contain %q:\n%s", want, s)
		}
	}
	if GetLevel() != slog.LevelInfo {
		t.Errorf("GetLevel() = %v, want INFO", GetLevel())
	}
}

// 記録される呼び出し元は、このパッケージではなく呼んだ側であること。
func TestCallerIsTheCaller(t *testing.T) {
	keepDefault(t)
	var records []slog.Record
	slog.SetDefault(slog.New(recordHandler{&records}))

	Warn("w %d", 1)
	PrintStackTrace(os.ErrNotExist)
	PrintTrace(Func("TestCallerIsTheCaller()"))

	if len(records) != 4 {
		t.Fatalf("records = %d, want 4", len(records))
	}
	for _, r := range records {
		fn := runtime.FuncForPC(r.PC).Name()
		if !strings.HasSuffix(fn, ".TestCallerIsTheCaller") {
			t.Errorf("%q recorded at %s, want the test function", r.Message, fn)
		}
	}
}

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
