package binder_test

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"binder"
	"binder/api/json"
	"binder/fs"
	"binder/test"
)

// setAssetAlias はアセットの alias だけを変えて保存する
func setAssetAlias(t *testing.T, b *binder.Binder, id, alias string) error {
	t.Helper()
	a, err := b.GetAsset(id)
	if err != nil {
		t.Fatalf("GetAsset(%q) error: %v", id, err)
	}
	a.Alias = alias
	_, err = b.EditAsset(a, "")
	return err
}

// TestRootAsset は alias が "/" で始まるアセット（サイトのルートに置くファイル）を検証する
func TestRootAsset(t *testing.T) {
	b := test.CreateBinder(t, "root_asset")
	defer b.Close()

	sys := b.GetFS()
	pub := sys.GetPublic()
	rootFile := filepath.Join(pub, "robots.txt")
	assetsFile := filepath.Join(pub, "assets", "robots.txt")

	exists := func(fn string) bool {
		_, err := sys.Stat(fn)
		return err == nil
	}

	a, err := b.AddTextAsset("index", false)
	if err != nil {
		t.Fatalf("AddTextAsset() error: %v", err)
	}
	if err := setAssetAlias(t, b, a.Id, "/robots.txt"); err != nil {
		t.Fatalf("EditAsset(/robots.txt) error: %v", err)
	}

	t.Run("publish to the root", func(t *testing.T) {
		if _, err := b.PublishAsset(a.Id); err != nil {
			t.Fatalf("PublishAsset() error: %v", err)
		}
		if !exists(rootFile) {
			t.Errorf("%s does not exist after publishing", rootFile)
		}
		if exists(assetsFile) {
			t.Errorf("%s exists, want only the root file", assetsFile)
		}
	})

	t.Run("url", func(t *testing.T) {
		elm := fmt.Sprintf(`{{ url "%s" }}`, a.Id)

		// pages/ のページからは 1 つ上
		leaf := findNonIndexNoteInBinder(t, b)
		html, warnings, err := b.ParseNote(leaf, false, elm)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		if html != "../robots.txt" {
			t.Errorf("url from a page = %q, want %q", html, "../robots.txt")
		}
		if len(warnings) != 0 {
			t.Errorf("warnings = %v, want none (published)", warnings)
		}

		// index（docs 直下）からは同じ階層
		index, err := b.GetNote("index")
		if err != nil {
			t.Fatalf("GetNote(index) error: %v", err)
		}
		html, _, err = b.ParseNote(index, false, elm)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		if html != "./robots.txt" {
			t.Errorf("url from index = %q, want %q", html, "./robots.txt")
		}
	})

	t.Run("resolve link path", func(t *testing.T) {
		s, err := b.ResolveLinkPath("/robots.txt")
		if err != nil {
			t.Fatalf("ResolveLinkPath() error: %v", err)
		}
		if s == nil || s.Id != a.Id {
			t.Errorf("ResolveLinkPath(/robots.txt) = %v, want the asset %s", s, a.Id)
		}
	})

	t.Run("move between the root and assets", func(t *testing.T) {
		// "/" を外すと docs/assets へ移る
		if err := setAssetAlias(t, b, a.Id, "robots.txt"); err != nil {
			t.Fatalf("EditAsset(robots.txt) error: %v", err)
		}
		if exists(rootFile) {
			t.Errorf("%s still exists after removing the leading /", rootFile)
		}
		if !exists(assetsFile) {
			t.Errorf("%s does not exist after removing the leading /", assetsFile)
		}

		// 付け直すとルートへ戻る
		if err := setAssetAlias(t, b, a.Id, "/robots.txt"); err != nil {
			t.Fatalf("EditAsset(/robots.txt) error: %v", err)
		}
		if !exists(rootFile) {
			t.Errorf("%s does not exist after adding the leading /", rootFile)
		}
		if exists(assetsFile) {
			t.Errorf("%s still exists after adding the leading /", assetsFile)
		}
	})

	t.Run("unpublish", func(t *testing.T) {
		if err := b.UnpublishAsset(a.Id); err != nil {
			t.Fatalf("UnpublishAsset() error: %v", err)
		}
		if exists(rootFile) {
			t.Errorf("%s still exists after unpublishing", rootFile)
		}
	})

	t.Run("invalid alias", func(t *testing.T) {
		tests := []struct {
			alias string
			want  error
		}{
			{"/index.html", fs.ErrReservedAlias},
			{"/pages", fs.ErrReservedAlias},
			{"/a/b.txt", fs.ErrInvalidAlias},
			{"../escape.txt", fs.ErrInvalidAlias},
			{"a/b.txt", fs.ErrInvalidAlias},
		}
		for _, tt := range tests {
			err := setAssetAlias(t, b, a.Id, tt.alias)
			if !errors.Is(err, tt.want) {
				t.Errorf("EditAsset(%q) = %v, want %v", tt.alias, err, tt.want)
			}
		}

		// 失敗した保存で alias は変わらない
		got, err := b.GetAsset(a.Id)
		if err != nil {
			t.Fatalf("GetAsset() error: %v", err)
		}
		if got.Alias != "/robots.txt" {
			t.Errorf("alias = %q after rejected edits, want %q", got.Alias, "/robots.txt")
		}
	})
}

// TestMigrateRootAssetToNote はルートのアセットをノートに移すとき、alias の "/" を持ち込まないことを検証する
func TestMigrateRootAssetToNote(t *testing.T) {
	b := test.CreateBinder(t, "migrate_root_asset")
	defer b.Close()

	a, err := b.AddTextAsset("index", false)
	if err != nil {
		t.Fatalf("AddTextAsset() error: %v", err)
	}
	if err := setAssetAlias(t, b, a.Id, "/robots.txt"); err != nil {
		t.Fatalf("EditAsset() error: %v", err)
	}

	n, err := b.MigrateAssetToNote(a.Id, false)
	if err != nil {
		t.Fatalf("MigrateAssetToNote() error: %v", err)
	}
	if n.Alias != "robots" {
		t.Errorf("note alias = %q, want %q", n.Alias, "robots")
	}
}

func findNonIndexNoteInBinder(t *testing.T, b *binder.Binder) *json.Note {
	t.Helper()
	tree, err := b.GetBinderTree()
	if err != nil {
		t.Fatalf("GetBinderTree() error: %v", err)
	}
	leaf := findNonIndexNote(tree.Data)
	if leaf == nil {
		t.Fatal("no non-index note found in binder tree")
	}
	n, err := b.GetNote(leaf.Id)
	if err != nil {
		t.Fatalf("GetNote(%q) error: %v", leaf.Id, err)
	}
	return n
}

// TestRootAssetPreviewServer はプレビューサーバが docs 直下のパスをルートのアセットとして扱うことを検証する
func TestRootAssetPreviewServer(t *testing.T) {
	b := test.CreateBinder(t, "root_asset_preview")
	defer b.Close()

	a, err := b.AddTextAsset("index", false)
	if err != nil {
		t.Fatalf("AddTextAsset() error: %v", err)
	}
	if err := setAssetAlias(t, b, a.Id, "/robots.txt"); err != nil {
		t.Fatalf("EditAsset() error: %v", err)
	}

	// アセットとして登録していない、手で置いたファイル
	sys := b.GetFS()
	fp, err := sys.Create(filepath.Join(sys.GetPublic(), "CNAME"))
	if err != nil {
		t.Fatalf("Create(CNAME) error: %v", err)
	}
	fp.Write([]byte("example.com"))
	fp.Close()

	h, err := b.PreviewHandler()
	if err != nil {
		t.Fatalf("PreviewHandler() error: %v", err)
	}
	get := func(path string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		return rec
	}

	t.Run("unpublished root asset", func(t *testing.T) {
		rec := get("/robots.txt")
		if rec.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
		}
		if !strings.Contains(rec.Body.String(), "まだ公開処理を行っていません") {
			t.Errorf("body = %q, want the not-published page", rec.Body.String())
		}
	})

	t.Run("published root asset", func(t *testing.T) {
		if _, err := b.PublishAsset(a.Id); err != nil {
			t.Fatalf("PublishAsset() error: %v", err)
		}
		if rec := get("/robots.txt"); rec.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
		}
	})

	t.Run("file placed by hand", func(t *testing.T) {
		// 登録の無い docs 直下のファイルは今までどおりそのまま返す
		rec := get("/CNAME")
		if rec.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
		}
		if rec.Body.String() != "example.com" {
			t.Errorf("body = %q, want %q", rec.Body.String(), "example.com")
		}
	})

	t.Run("missing file", func(t *testing.T) {
		if rec := get("/no-such-file.txt"); rec.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
		}
	})
}
