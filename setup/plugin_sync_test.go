package setup

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"binder/settings"
)

func setupSyncHome(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if runtime.GOOS == "windows" {
		t.Setenv("USERPROFILE", dir)
	} else {
		t.Setenv("HOME", dir)
	}
	return dir
}

// bundledPlugin は埋め込みの同梱プラグイン内容を返す。
func bundledPlugin(t *testing.T, name string) []byte {
	t.Helper()
	data, err := embFs.ReadFile("_assets/plugins/marked/" + name)
	if err != nil {
		t.Fatalf("embFs.ReadFile(%s) error: %v", name, err)
	}
	return data
}

func TestSyncSamplePluginsOverwritesBaseline(t *testing.T) {
	setupSyncHome(t)
	dir := settings.PluginsEngineDirPath("marked")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatalf("MkdirAll error: %v", err)
	}

	// 0.12.0 baseline の kbd.js（既知ハッシュ）をユーザ環境に置く
	baseline := []byte(`/* @plugin-name: Keyboard Tag ([[Key]]) */
//
// [[キー]] を <kbd> タグに変換する。
//
// 使い方:
//   [[Ctrl+C]] でコピー、[[Ctrl+V]] でペースト。
//   [[Enter]] を押して確定する。
//
(function() {
  return {
    extensions: [
      {
        name: 'kbd',
        level: 'inline',
        start: function(src) {
          var m = src.match(/\[\[/);
          return m ? m.index : undefined;
        },
        tokenizer: function(src) {
          var match = src.match(/^\[\[([^\]]+)\]\]/);
          if (match) {
            return {
              type: 'kbd',
              raw: match[0],
              text: match[1],
            };
          }
        },
        renderer: function(token) {
          return '<kbd>' + token.text + '</kbd>';
        }
      }
    ]
  };
})();
`)
	// baseline のハッシュが既知集合に含まれることを前提にする
	if got := sha256Hex(baseline); !isKnownShippedHash("kbd.js", got, "dummy") {
		t.Fatalf("baseline kbd.js hash %s not in known set (テストの baseline 内容を実ファイルに合わせて更新すること)", got)
	}

	kbdPath := filepath.Join(dir, "kbd.js")
	if err := os.WriteFile(kbdPath, baseline, 0644); err != nil {
		t.Fatalf("WriteFile error: %v", err)
	}

	if err := SyncSamplePlugins(); err != nil {
		t.Fatalf("SyncSamplePlugins error: %v", err)
	}

	got, _ := os.ReadFile(kbdPath)
	want := bundledPlugin(t, "kbd.js")
	if string(got) != string(want) {
		t.Errorf("baseline kbd.js was not updated to bundled version")
	}
}

func TestSyncSamplePluginsPreservesUserEdits(t *testing.T) {
	setupSyncHome(t)
	dir := settings.PluginsEngineDirPath("marked")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatalf("MkdirAll error: %v", err)
	}

	edited := []byte("/* user's own edited plugin */\n(function(){ return {}; })();\n")
	kbdPath := filepath.Join(dir, "kbd.js")
	if err := os.WriteFile(kbdPath, edited, 0644); err != nil {
		t.Fatalf("WriteFile error: %v", err)
	}

	if err := SyncSamplePlugins(); err != nil {
		t.Fatalf("SyncSamplePlugins error: %v", err)
	}

	got, _ := os.ReadFile(kbdPath)
	if string(got) != string(edited) {
		t.Errorf("user-edited kbd.js was overwritten (should be preserved)")
	}
}

func TestSyncSamplePluginsDoesNotResurrectDeleted(t *testing.T) {
	setupSyncHome(t)
	dir := settings.PluginsEngineDirPath("marked")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatalf("MkdirAll error: %v", err)
	}
	// 何も置かない（ユーザが全削除した状態）
	if err := SyncSamplePlugins(); err != nil {
		t.Fatalf("SyncSamplePlugins error: %v", err)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 0 {
		t.Errorf("deleted plugins were resurrected: %d files present", len(entries))
	}
}

func TestSyncSamplePluginsIdempotentOnCurrent(t *testing.T) {
	setupSyncHome(t)
	dir := settings.PluginsEngineDirPath("marked")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatalf("MkdirAll error: %v", err)
	}
	// 既に最新の同梱版が置かれている
	cur := bundledPlugin(t, "kbd.js")
	kbdPath := filepath.Join(dir, "kbd.js")
	if err := os.WriteFile(kbdPath, cur, 0644); err != nil {
		t.Fatalf("WriteFile error: %v", err)
	}
	if err := SyncSamplePlugins(); err != nil {
		t.Fatalf("SyncSamplePlugins error: %v", err)
	}
	got, _ := os.ReadFile(kbdPath)
	if string(got) != string(cur) {
		t.Errorf("current kbd.js changed unexpectedly")
	}
}
