package logging

import (
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wenteasy/log"
)

func TestInit(t *testing.T) {
	tmp := t.TempDir()
	// os.TempDir() が見る環境変数（Windows は TMP / TEMP、それ以外は TMPDIR）
	t.Setenv("TMP", tmp)
	t.Setenv("TEMP", tmp)
	t.Setenv("TMPDIR", tmp)

	def := slog.Default()
	lv := GetLevel()
	t.Cleanup(func() {
		Close()
		slog.SetDefault(def)
		SetLevel(lv)
	})

	if _, err := Init(); err != nil {
		t.Fatalf("Init() error: %+v", err)
	}
	if p := Path(); p != "" {
		t.Errorf("Path() before first write = %q, want empty", p)
	}

	SetLevel(slog.LevelInfo)
	log.Debugf("hidden %d", 1)
	log.Warnf("shown %d", 2)
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
