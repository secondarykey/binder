package settings

import (
	"os"
	"runtime"
	"testing"
)

func setPVHome(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	if runtime.GOOS == "windows" {
		t.Setenv("USERPROFILE", dir)
	} else {
		t.Setenv("HOME", dir)
	}
	// save() は ~/.binder ディレクトリの存在を前提にするため作成する
	if err := os.MkdirAll(DirPath(), 0755); err != nil {
		t.Fatalf("MkdirAll(%s) error: %v", DirPath(), err)
	}
	// Get() のキャッシュをリセットして tempdir を反映させる
	pSet = nil
}

func TestPluginVerifiedSetGet(t *testing.T) {
	setPVHome(t)

	if got := GetPluginVerified("/binderA", "marked"); len(got) != 0 {
		t.Fatalf("expected empty, got %v", got)
	}

	if err := SetPluginVerified("/binderA", "marked", "kbd", 14); err != nil {
		t.Fatalf("SetPluginVerified error: %v", err)
	}
	if err := SetPluginVerified("/binderA", "marked", "toc", 18); err != nil {
		t.Fatalf("SetPluginVerified error: %v", err)
	}
	// 別バインダーは分離される
	if err := SetPluginVerified("/binderB", "marked", "kbd", 17); err != nil {
		t.Fatalf("SetPluginVerified error: %v", err)
	}

	a := GetPluginVerified("/binderA", "marked")
	if a["kbd"] != 14 || a["toc"] != 18 {
		t.Errorf("binderA = %v, want kbd=14 toc=18", a)
	}
	b := GetPluginVerified("/binderB", "marked")
	if b["kbd"] != 17 || len(b) != 1 {
		t.Errorf("binderB = %v, want only kbd=17", b)
	}
}

func TestPluginVerifiedDelete(t *testing.T) {
	setPVHome(t)
	SetPluginVerified("/b", "marked", "kbd", 14)
	if err := DeletePluginVerified("/b", "marked", "kbd"); err != nil {
		t.Fatalf("DeletePluginVerified error: %v", err)
	}
	if got := GetPluginVerified("/b", "marked"); len(got) != 0 {
		t.Errorf("expected empty after delete, got %v", got)
	}
	// 存在しないキーの削除はエラーにしない
	if err := DeletePluginVerified("/b", "marked", "missing"); err != nil {
		t.Errorf("delete missing should be nil, got %v", err)
	}
}

func TestPluginVerifiedRename(t *testing.T) {
	setPVHome(t)
	SetPluginVerified("/b", "marked", "old", 15)
	if err := RenamePluginVerified("/b", "marked", "old", "new"); err != nil {
		t.Fatalf("RenamePluginVerified error: %v", err)
	}
	got := GetPluginVerified("/b", "marked")
	if got["new"] != 15 {
		t.Errorf("expected new=15, got %v", got)
	}
	if _, ok := got["old"]; ok {
		t.Errorf("old key should be gone, got %v", got)
	}
}

func TestPluginVerifiedEngineScope(t *testing.T) {
	setPVHome(t)
	SetPluginVerified("/b", "marked", "x", 14)
	SetPluginVerified("/b", "other", "x", 99)
	m := GetPluginVerified("/b", "marked")
	if m["x"] != 14 || len(m) != 1 {
		t.Errorf("engine scope leaked: %v", m)
	}
}
