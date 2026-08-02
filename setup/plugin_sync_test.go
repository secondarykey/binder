package setup

import (
	"bytes"
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

// 同梱プラグインを更新したのに shippedPluginHashes へ追記し忘れると、
// 直前版を持つユーザが「編集済み」扱いになり配布更新が届かなくなる。
// 追記漏れそのものは後から検出できないが、ファイルの追加漏れは検出できる。
func TestShippedPluginHashesCoversAllBundled(t *testing.T) {
	entries, err := embFs.ReadDir("_assets/plugins/marked")
	if err != nil {
		t.Fatalf("embFs.ReadDir error: %v", err)
	}

	bundled := map[string]bool{}
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".js" {
			continue
		}
		bundled[e.Name()] = true
		if len(shippedPluginHashes[e.Name()]) == 0 {
			t.Errorf("shippedPluginHashes に %s のエントリが無い", e.Name())
		}
	}

	for name := range shippedPluginHashes {
		if !bundled[name] {
			t.Errorf("shippedPluginHashes の %s は同梱プラグインに存在しない", name)
		}
	}
}

// 現行の同梱版ハッシュは実行時に算出されるため、過去分として重複登録してはいけない
// （登録すると「更新前と同じ内容」を過去版と誤認する余地が残る）。
func TestShippedPluginHashesExcludesCurrent(t *testing.T) {
	for name, hashes := range shippedPluginHashes {
		cur := sha256Hex(bundledPlugin(t, name))
		for _, h := range hashes {
			if h == cur {
				t.Errorf("%s: 現行版のハッシュが過去分として登録されている", name)
			}
		}
	}
}

// ユーザ環境のファイルの改行は「どのビルドが書いたか」で変わる（//go:embed が読む
// ワークツリーの改行がビルド環境の core.autocrlf に依存するため）。
// 生バイトで突き合わせると、内容が同一でも改行違いで「ユーザ編集済み」と判定され、
// 更新が永久に届かなくなる。実際に Windows 環境で全プラグインが更新されなかった。
func TestSyncSamplePluginsUpdatesCRLFInstall(t *testing.T) {
	setupSyncHome(t)
	dir := settings.PluginsEngineDirPath("marked")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatalf("MkdirAll error: %v", err)
	}

	// 過去に配布した版を CRLF で置いた状態を作る
	old := []byte("/* @plugin-name: SmartPants (Typography) */\n/* @marked: >=14 <19 */\n(function(){})();\n")
	crlf := bytes.ReplaceAll(old, []byte("\n"), []byte("\r\n"))
	path := filepath.Join(dir, "smartypants.js")
	if err := os.WriteFile(path, crlf, 0644); err != nil {
		t.Fatalf("WriteFile error: %v", err)
	}

	// その版を既知配布ハッシュ（LF 基準）として登録する
	orig := shippedPluginHashes["smartypants.js"]
	shippedPluginHashes["smartypants.js"] = append([]string{sha256Hex(old)}, orig...)
	t.Cleanup(func() { shippedPluginHashes["smartypants.js"] = orig })

	if err := SyncSamplePlugins(); err != nil {
		t.Fatalf("SyncSamplePlugins error: %v", err)
	}

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile error: %v", err)
	}
	want := normalizeNewlines(bundledPlugin(t, "smartypants.js"))
	if !bytes.Equal(got, want) {
		t.Errorf("CRLF で置かれた配布版が更新されていない")
	}
	if bytes.Contains(got, []byte("\r\n")) {
		t.Errorf("書き出した内容に CRLF が残っている（次回の突き合わせが環境依存になる）")
	}
}

// 改行だけが違う同一内容は「更新済み」として扱い、書き込みを起こさない
func TestSyncSamplePluginsTreatsCRLFCurrentAsUpToDate(t *testing.T) {
	setupSyncHome(t)
	dir := settings.PluginsEngineDirPath("marked")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatalf("MkdirAll error: %v", err)
	}

	cur := bundledPlugin(t, "kbd.js")
	crlf := bytes.ReplaceAll(normalizeNewlines(cur), []byte("\n"), []byte("\r\n"))
	path := filepath.Join(dir, "kbd.js")
	if err := os.WriteFile(path, crlf, 0644); err != nil {
		t.Fatalf("WriteFile error: %v", err)
	}

	if err := SyncSamplePlugins(); err != nil {
		t.Fatalf("SyncSamplePlugins error: %v", err)
	}

	got, _ := os.ReadFile(path)
	if !bytes.Equal(got, crlf) {
		t.Errorf("改行違いだけの同一内容が書き換えられた")
	}
}
