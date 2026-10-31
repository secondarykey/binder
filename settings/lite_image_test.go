package settings

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

var testPNG = []byte("\x89PNG\r\n\x1a\nfake")

func b64(b []byte) string { return base64.StdEncoding.EncodeToString(b) }

// 画像はファイルの隣の <ファイル名>.assets/ に置き、本文に書く相対パスを返す
func TestSaveLiteImageNextToFile(t *testing.T) {
	dir := t.TempDir()
	doc := filepath.Join(dir, "memo.md")

	rel, err := SaveLiteImage(doc, "", b64(testPNG), ".png")
	if err != nil {
		t.Fatalf("SaveLiteImage() error: %v", err)
	}
	if !strings.HasPrefix(rel, "memo.assets/") || !strings.HasSuffix(rel, ".png") {
		t.Fatalf("rel = %q", rel)
	}
	got, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(rel)))
	if err != nil || string(got) != string(testPNG) {
		t.Fatalf("saved file = %q, %v", got, err)
	}

	// 同じ時刻に貼っても上書きしない
	rel2, err := SaveLiteImage(doc, "", b64(testPNG), "png")
	if err != nil {
		t.Fatalf("SaveLiteImage() 2 error: %v", err)
	}
	if rel2 == rel {
		t.Errorf("second image has the same name: %q", rel2)
	}
}

func TestSaveLiteImageRejects(t *testing.T) {
	setTestHome(t)
	doc := filepath.Join(t.TempDir(), "memo.md")
	if _, err := SaveLiteImage(doc, "", b64(testPNG), ".exe"); err == nil {
		t.Error("unsupported extension was accepted")
	}
	if _, err := SaveLiteImage("", "../evil", b64(testPNG), ".png"); err == nil {
		t.Error("invalid work name was accepted")
	}
	if _, err := SaveLiteImage("", "", b64(testPNG), ".png"); err == nil {
		t.Error("no path and no work was accepted")
	}
}

// ワークの画像は works/<ワーク名>.assets/ に置き、ワークを消すと一緒に消える
func TestLiteWorkImage(t *testing.T) {
	setTestHome(t)
	name, err := CreateLiteWork()
	if err != nil {
		t.Fatalf("CreateLiteWork() error: %v", err)
	}
	rel, err := SaveLiteImage("", name, b64(testPNG), ".png")
	if err != nil {
		t.Fatalf("SaveLiteImage() error: %v", err)
	}
	if !strings.HasPrefix(rel, name+".assets/") {
		t.Fatalf("rel = %q", rel)
	}
	uri, err := ReadLiteImage("", name, rel)
	if err != nil || !strings.HasPrefix(uri, "data:image/png;base64,") {
		t.Fatalf("ReadLiteImage() = %q, %v", uri, err)
	}

	if err := DeleteLiteWork(name); err != nil {
		t.Fatalf("DeleteLiteWork() error: %v", err)
	}
	if _, err := os.Stat(filepath.Join(LiteWorkDirPath(), name+".assets")); !os.IsNotExist(err) {
		t.Errorf("work assets remain: %v", err)
	}
}

// 前に同じ名前で使われたワークの画像は、新しいワークに引き継がない
func TestCreateLiteWorkClearsStaleAssets(t *testing.T) {
	setTestHome(t)
	stale := filepath.Join(LiteWorkDirPath(), "Untitled.assets")
	if err := os.MkdirAll(stale, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(stale, "old.png"), testPNG, 0644); err != nil {
		t.Fatal(err)
	}
	name, err := CreateLiteWork()
	if err != nil || name != "Untitled" {
		t.Fatalf("CreateLiteWork() = %q, %v", name, err)
	}
	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Errorf("stale assets remain: %v", err)
	}
}

func TestReadLiteImageRejects(t *testing.T) {
	dir := t.TempDir()
	doc := filepath.Join(dir, "memo.md")
	if err := os.WriteFile(filepath.Join(dir, "note.txt"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	for _, src := range []string{
		"note.txt",                   // 画像ではない
		"https://example.com/a.png",  // URL
		"data:image/png;base64,AAAA", // data URI
		"/etc/a.png",                 // 絶対パス
		filepath.Join(dir, "a.png"),  // 絶対パス（OS の形）
		"missing.png",                // 無い
	} {
		if _, err := ReadLiteImage(doc, "", src); err == nil {
			t.Errorf("ReadLiteImage(%q) was accepted", src)
		}
	}
}

// 保存先が変わると、本文が参照する画像を新しい .assets へ写してパスを書き換える
func TestRelocateLiteAssets(t *testing.T) {
	setTestHome(t)
	name, err := CreateLiteWork()
	if err != nil {
		t.Fatalf("CreateLiteWork() error: %v", err)
	}
	rel, err := SaveLiteImage("", name, b64(testPNG), ".png")
	if err != nil {
		t.Fatalf("SaveLiteImage() error: %v", err)
	}
	img := strings.TrimPrefix(rel, name+".assets/")

	dir := t.TempDir()
	to := filepath.Join(dir, "my memo.md")
	content := "![](" + rel + ")\n" +
		"![](<./" + rel + ">)\n" +
		"![](" + name + ".assets/missing.png)\n" +
		"![](My" + rel + ")\n"

	got, err := RelocateLiteAssets("", name, to, content)
	if err != nil {
		t.Fatalf("RelocateLiteAssets() error: %v", err)
	}
	want := "![](my memo.assets/" + img + ")\n" +
		"![](<./my memo.assets/" + img + ">)\n" +
		"![](" + name + ".assets/missing.png)\n" +
		"![](My" + rel + ")\n"
	if got != want {
		t.Errorf("content =\n%s\nwant\n%s", got, want)
	}
	if b, err := os.ReadFile(filepath.Join(dir, "my memo.assets", img)); err != nil || string(b) != string(testPNG) {
		t.Errorf("copied image = %q, %v", b, err)
	}

	// 同じ保存先なら何もしない
	same, err := RelocateLiteAssets(to, "", to, got)
	if err != nil || same != got {
		t.Errorf("same path changed content: %v", err)
	}
}

// 写し先に同じ名前の別の画像があるときは、名前を変えて写す
func TestRelocateLiteAssetsNameConflict(t *testing.T) {
	dir := t.TempDir()
	from := filepath.Join(dir, "a.md")
	to := filepath.Join(dir, "b.md")
	for _, p := range []struct{ dir, data string }{{"a.assets", "new"}, {"b.assets", "old"}} {
		if err := os.MkdirAll(filepath.Join(dir, p.dir), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, p.dir, "x.png"), []byte(p.data), 0644); err != nil {
			t.Fatal(err)
		}
	}

	got, err := RelocateLiteAssets(from, "", to, "![](a.assets/x.png) ![](a.assets/x.png)")
	if err != nil {
		t.Fatalf("RelocateLiteAssets() error: %v", err)
	}
	if want := "![](b.assets/x-2.png) ![](b.assets/x-2.png)"; got != want {
		t.Errorf("content = %q, want %q", got, want)
	}
	if b, _ := os.ReadFile(filepath.Join(dir, "b.assets", "x.png")); string(b) != "old" {
		t.Errorf("existing image was overwritten: %q", b)
	}
	if b, _ := os.ReadFile(filepath.Join(dir, "b.assets", "x-2.png")); string(b) != "new" {
		t.Errorf("copied image = %q", b)
	}
}
