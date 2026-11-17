package binder_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"binder/test"
)

// TestPreviewServerDirectory はプレビューサーバがディレクトリの URL に
// 「Error reading directory」（500）ではなく、何が無いのか分かるページを返すことを検証する
func TestPreviewServerDirectory(t *testing.T) {
	b := test.CreateBinder(t, "preview_directory")
	defer b.Close()

	get := func(t *testing.T, path string) *httptest.ResponseRecorder {
		t.Helper()
		h, err := b.PreviewHandler()
		if err != nil {
			t.Fatalf("PreviewHandler() error: %v", err)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		return rec
	}

	t.Run("root before anything is published", func(t *testing.T) {
		rec := get(t, "/")
		if rec.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
		}
		if !strings.Contains(rec.Body.String(), "トップページ（index）はまだ公開処理を行っていません") {
			t.Errorf("body = %q, want the index not-published page", rec.Body.String())
		}
	})

	// index 以外を公開して、docs/ と docs/pages/ はあるが docs/index.html は無い状態にする
	other := createChildNote(t, b, "index", "other")
	if _, err := b.PublishNote(other, []byte("<p>other</p>")); err != nil {
		t.Fatalf("PublishNote() error: %v", err)
	}

	t.Run("root without index.html", func(t *testing.T) {
		rec := get(t, "/")
		if rec.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
		}
		if !strings.Contains(rec.Body.String(), "トップページ（index）はまだ公開処理を行っていません") {
			t.Errorf("body = %q, want the index not-published page", rec.Body.String())
		}
	})

	for _, path := range []string{"/pages/", "/pages"} {
		t.Run("directory "+path, func(t *testing.T) {
			rec := get(t, path)
			if rec.Code != http.StatusNotFound {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
			}
			if strings.Contains(rec.Body.String(), "Error reading directory") {
				t.Errorf("body = %q, want a not-found page", rec.Body.String())
			}
		})
	}

	if _, err := b.PublishNote("index", []byte("<p>top page</p>")); err != nil {
		t.Fatalf("PublishNote(index) error: %v", err)
	}

	t.Run("root after publishing index", func(t *testing.T) {
		rec := get(t, "/")
		if rec.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
		}
		if !strings.Contains(rec.Body.String(), "top page") {
			t.Errorf("body = %q, want the index page", rec.Body.String())
		}
	})
}
