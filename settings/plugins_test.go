package settings

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func setPluginsHome(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	if runtime.GOOS == "windows" {
		t.Setenv("USERPROFILE", dir)
	} else {
		t.Setenv("HOME", dir)
	}
	if err := os.MkdirAll(DirPath(), 0755); err != nil {
		t.Fatalf("MkdirAll(%s) error: %v", DirPath(), err)
	}
	pSet = nil
}

// ListAppPlugins は設定画面がメタデータ（@plugin-version / @marked）を解析できるよう
// 内容込みで返す。名前だけになると設定画面が対応 marked を出せなくなる。
func TestListAppPluginsReturnsContent(t *testing.T) {
	setPluginsHome(t)

	const body = "/* @plugin-version: 1.2.0 */\n/* @marked: >=14 <19 */\n(function(){})();"
	if err := SaveAppPlugin("marked", "kbd", body); err != nil {
		t.Fatalf("SaveAppPlugin error: %v", err)
	}
	// .js 以外は一覧に含めない
	if err := os.WriteFile(filepath.Join(PluginsEngineDirPath("marked"), "readme.txt"), []byte("x"), 0644); err != nil {
		t.Fatalf("WriteFile error: %v", err)
	}

	list, err := ListAppPlugins("marked")
	if err != nil {
		t.Fatalf("ListAppPlugins error: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("len(list) = %d, want 1 (%v)", len(list), list)
	}
	if list[0].Name != "kbd" {
		t.Errorf("Name = %q, want kbd", list[0].Name)
	}
	if list[0].Content != body {
		t.Errorf("Content = %q, want %q", list[0].Content, body)
	}
}

// ディレクトリが無いだけならエラーにせず空を返す（プラグイン未使用の通常状態）
func TestListAppPluginsMissingDir(t *testing.T) {
	setPluginsHome(t)

	list, err := ListAppPlugins("marked")
	if err != nil {
		t.Fatalf("ListAppPlugins error: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("len(list) = %d, want 0", len(list))
	}
}
