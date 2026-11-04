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
	"binder/db"
	"binder/fs"
	"binder/test"
)

// setNoteAlias はノートの alias だけを変えて保存する
func setNoteAlias(t *testing.T, b *binder.Binder, id, alias string) error {
	t.Helper()
	n, err := b.GetNote(id)
	if err != nil {
		t.Fatalf("GetNote(%q) error: %v", id, err)
	}
	n.Alias = alias
	_, err = b.EditNote(n, "")
	return err
}

// createErrorPage は 404 ページにするノートを作る
func createErrorPage(t *testing.T, b *binder.Binder) string {
	t.Helper()
	id := createChildNote(t, b, "index", "NotFound")
	if err := setNoteAlias(t, b, id, json.ErrorPageAlias); err != nil {
		t.Fatalf("EditNote(/404) error: %v", err)
	}
	return id
}

func parseNoteHTML(t *testing.T, b *binder.Binder, id string, local bool, elm string) (string, []string) {
	t.Helper()
	n, err := b.GetNote(id)
	if err != nil {
		t.Fatalf("GetNote(%q) error: %v", id, err)
	}
	html, warnings, err := b.ParseNote(n, local, elm)
	if err != nil {
		t.Fatalf("ParseNote() error: %v", err)
	}
	return html, warnings
}

// TestErrorPagePublish は alias "/404" のノートが docs/404.html に公開されることを検証する
func TestErrorPagePublish(t *testing.T) {
	b := test.CreateBinder(t, "error_page_publish")
	defer b.Close()

	sys := b.GetFS()
	pub := sys.GetPublic()
	exists := func(fn string) bool {
		_, err := sys.Stat(fn)
		return err == nil
	}

	id := createErrorPage(t, b)
	if _, err := b.PublishNote(id, []byte("<p>not found</p>")); err != nil {
		t.Fatalf("PublishNote() error: %v", err)
	}
	if !exists(filepath.Join(pub, "404.html")) {
		t.Errorf("docs/404.html does not exist after publishing")
	}
	if exists(filepath.Join(pub, "pages", "404.html")) {
		t.Errorf("docs/pages/404.html exists, want only docs/404.html")
	}

	// 取り下げると消える
	if err := b.UnpublishNote(id); err != nil {
		t.Fatalf("UnpublishNote() error: %v", err)
	}
	if exists(filepath.Join(pub, "404.html")) {
		t.Errorf("docs/404.html still exists after unpublishing")
	}

	s, err := b.ResolveLinkPath("/404.html")
	if err != nil {
		t.Fatalf("ResolveLinkPath() error: %v", err)
	}
	if s == nil || s.Id != id {
		t.Errorf("ResolveLinkPath(/404.html) = %v, want the error page %s", s, id)
	}
}

// TestErrorPageAlias はノートの alias の検証を確かめる
func TestErrorPageAlias(t *testing.T) {
	b := test.CreateBinder(t, "error_page_alias")
	defer b.Close()

	createErrorPage(t, b)
	other := createChildNote(t, b, "index", "other")

	tests := []struct {
		id    string
		alias string
		want  error
	}{
		{other, json.ErrorPageAlias, db.DuplicateAlias}, // 404 ページはバインダーに 1 つ
		{"index", json.ErrorPageAlias, fs.ErrInvalidAlias},
		{other, "/about", fs.ErrInvalidAlias}, // ルートに置けるノートは 404 ページだけ
		{other, "a/b", fs.ErrInvalidAlias},
		{other, "../escape", fs.ErrInvalidAlias},
	}
	for _, tt := range tests {
		err := setNoteAlias(t, b, tt.id, tt.alias)
		if !errors.Is(err, tt.want) {
			t.Errorf("EditNote(%s, %q) = %v, want %v", tt.id, tt.alias, err, tt.want)
		}
	}
}

// TestErrorPageURL は 404 ページの URL の基準がサイトのルートからのパスになることを検証する
func TestErrorPageURL(t *testing.T) {
	b := test.CreateBinder(t, "error_page_url")
	defer b.Close()

	id := createErrorPage(t, b)
	other := createChildNote(t, b, "index", "other")
	on, err := b.GetNote(other)
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}
	elm := fmt.Sprintf(`{{ url "%s" }}`, other)

	t.Run("unknown site URL", func(t *testing.T) {
		// サイトの URL が分からなければ docs 直下と同じ "./" にして警告する
		html, warnings := parseNoteHTML(t, b, id, false, elm)
		if want := "./pages/" + on.Alias + ".html"; html != want {
			t.Errorf("url = %q, want %q", html, want)
		}
		if !hasWarning(warnings, "404 page: site URL is unknown") {
			t.Errorf("warnings = %v, want a site URL warning", warnings)
		}
	})

	setSiteURL(t, b, "https://user.github.io/repo/")

	t.Run("published", func(t *testing.T) {
		html, warnings := parseNoteHTML(t, b, id, false, elm)
		if want := "/repo/pages/" + on.Alias + ".html"; html != want {
			t.Errorf("url = %q, want %q", html, want)
		}
		if hasWarning(warnings, "404 page") {
			t.Errorf("warnings = %v, want no site URL warning", warnings)
		}
	})

	t.Run("fullURL", func(t *testing.T) {
		html, _ := parseNoteHTML(t, b, id, false, `{{ fullURL }}`)
		if want := "https://user.github.io/repo/404.html"; html != want {
			t.Errorf("fullURL = %q, want %q", html, want)
		}
	})

	t.Run("preview", func(t *testing.T) {
		// プレビューは docs 直下と同じ相対パス
		html, _ := parseNoteHTML(t, b, id, true, elm)
		if want := "./pages/" + on.Alias + ".html"; html != want {
			t.Errorf("url = %q, want %q", html, want)
		}
	})

	t.Run("custom domain", func(t *testing.T) {
		setSiteURL(t, b, "https://example.com/")
		html, _ := parseNoteHTML(t, b, id, false, elm)
		if want := "/pages/" + on.Alias + ".html"; html != want {
			t.Errorf("url = %q, want %q", html, want)
		}
	})
}

// TestEmbedURLFollowsPage は embed で展開したノートの URL が、埋め込み先のページの位置で決まることを検証する
func TestEmbedURLFollowsPage(t *testing.T) {
	b := test.CreateBinder(t, "embed_url_page")
	defer b.Close()

	setSiteURL(t, b, "https://user.github.io/repo/")
	errorPage := createErrorPage(t, b)
	footer := createChildNote(t, b, "index", "footer")
	target := createChildNote(t, b, "index", "target")
	tn, err := b.GetNote(target)
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}
	if err := b.SaveNote(footer, []byte(fmt.Sprintf(`{{ url "%s" }}`, target))); err != nil {
		t.Fatalf("SaveNote() error: %v", err)
	}
	elm := fmt.Sprintf(`{{ embed "%s" }}`, footer)

	tests := []struct {
		page string
		want string
	}{
		{errorPage, "/repo/pages/" + tn.Alias + ".html"},
		{"index", "./pages/" + tn.Alias + ".html"},
	}
	for _, tt := range tests {
		html, _ := parseNoteHTML(t, b, tt.page, false, elm)
		if !strings.Contains(html, tt.want) {
			t.Errorf("embed in %s = %q, want it to contain %q", tt.page, html, tt.want)
		}
	}
}

// TestErrorPageExcludedFromLists は 404 ページが childNotes / latestNotes / 前後のノートに並ばないことを検証する
func TestErrorPageExcludedFromLists(t *testing.T) {
	b := test.CreateBinder(t, "error_page_lists")
	defer b.Close()

	errorPage := createErrorPage(t, b)
	other := createChildNote(t, b, "index", "other")
	for _, id := range []string{errorPage, other} {
		if _, err := b.PublishNote(id, []byte("<p>note</p>")); err != nil {
			t.Fatalf("PublishNote() error: %v", err)
		}
	}

	for _, local := range []bool{true, false} {
		for _, elm := range []string{
			`{{ range childNotes }}[{{ .Id }}]{{ end }}`,
			`{{ range childNotes -1 "index" "seq" }}[{{ .Id }}]{{ end }}`,
			`{{ range latestNotes 100 }}[{{ .Id }}]{{ end }}`,
		} {
			html, _ := parseNoteHTML(t, b, "index", local, elm)
			if strings.Contains(html, errorPage) {
				t.Errorf("local=%v %s = %q, want no error page", local, elm, html)
			}
			if !strings.Contains(html, other) {
				t.Errorf("local=%v %s = %q, want the other note", local, elm, html)
			}
		}
	}

	// 前後のノートでも飛ばす（404 ページは other の直前に作っている）
	html, _ := parseNoteHTML(t, b, other, false, `{{ with prevNote }}{{ .Id }}{{ end }}`)
	if html == errorPage {
		t.Errorf("prevNote of other = the error page, want it skipped")
	}
	// 404 ページ自身から見た前後は出せる（自分は順番に含める）
	html, _ = parseNoteHTML(t, b, errorPage, false, `{{ with nextNote }}{{ .Id }}{{ end }}`)
	if html != other {
		t.Errorf("nextNote of the error page = %q, want %q", html, other)
	}
}

// TestErrorPageRename は 404 ページになる・やめる変更で、書き出し済みの HTML を移さずに消すことを検証する
func TestErrorPageRename(t *testing.T) {
	b := test.CreateBinder(t, "error_page_rename")
	defer b.Close()

	sys := b.GetFS()
	pub := sys.GetPublic()
	exists := func(fn string) bool {
		_, err := sys.Stat(fn)
		return err == nil
	}

	id := createChildNote(t, b, "index", "page")
	n, err := b.GetNote(id)
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}
	pageFile := filepath.Join(pub, "pages", n.Alias+".html")
	if _, err := b.PublishNote(id, []byte("<p>note</p>")); err != nil {
		t.Fatalf("PublishNote() error: %v", err)
	}
	if !exists(pageFile) {
		t.Fatalf("%s does not exist after publishing", pageFile)
	}

	if err := setNoteAlias(t, b, id, json.ErrorPageAlias); err != nil {
		t.Fatalf("EditNote(/404) error: %v", err)
	}
	if exists(pageFile) {
		t.Errorf("%s still exists after becoming the error page", pageFile)
	}
	// URL の基準が違うので移さない。公開し直すまで docs/404.html は無い
	if exists(filepath.Join(pub, "404.html")) {
		t.Errorf("docs/404.html exists, want it to be written by republishing")
	}
	got, err := b.GetNote(id)
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}
	if got.PublishStatus != json.UpdatedStatus {
		t.Errorf("PublishStatus = %v, want %v (needs republishing)", got.PublishStatus, json.UpdatedStatus)
	}
}

// TestErrorPagePreviewServer はプレビューサーバが存在しないパスに 404 ページを返すことを検証する
func TestErrorPagePreviewServer(t *testing.T) {
	b := test.CreateBinder(t, "error_page_preview")
	defer b.Close()

	setSiteURL(t, b, "https://user.github.io/repo/")
	other := createChildNote(t, b, "index", "other")
	on, err := b.GetNote(other)
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}
	if _, err := b.PublishNote(other, []byte("<p>other</p>")); err != nil {
		t.Fatalf("PublishNote() error: %v", err)
	}

	h, err := b.PreviewHandler()
	if err != nil {
		t.Fatalf("PreviewHandler() error: %v", err)
	}
	get := func(path string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		return rec
	}

	t.Run("without a 404 page", func(t *testing.T) {
		rec := get("/no-such-page.html")
		if rec.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
		}
		if !strings.Contains(rec.Body.String(), "存在しません") {
			t.Errorf("body = %q, want the built-in not-found page", rec.Body.String())
		}
	})

	errorPage := createErrorPage(t, b)
	if _, err := b.PublishNote(errorPage, []byte("<p>custom not found</p>")); err != nil {
		t.Fatalf("PublishNote() error: %v", err)
	}

	for _, path := range []string{"/no-such-page.html", "/pages/a/b/c.html", "/pages/no-such-alias.html", "/repo/missing"} {
		t.Run("missing "+path, func(t *testing.T) {
			rec := get(path)
			if rec.Code != http.StatusNotFound {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
			}
			if !strings.Contains(rec.Body.String(), "custom not found") {
				t.Errorf("body = %q, want the 404 page", rec.Body.String())
			}
		})
	}

	t.Run("site path", func(t *testing.T) {
		// 404 ページの中のリンク（"/repo/pages/x.html"）をプレビューでも辿れる
		rec := get("/repo/pages/" + on.Alias + ".html")
		if rec.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
		}
		if !strings.Contains(rec.Body.String(), "other") {
			t.Errorf("body = %q, want the other page", rec.Body.String())
		}
	})

	t.Run("existing page", func(t *testing.T) {
		if rec := get("/pages/" + on.Alias + ".html"); rec.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
		}
	})

	t.Run("unpublished note keeps the built-in page", func(t *testing.T) {
		// 未公開・非公開は作者向けの案内を残す
		draft := createChildNote(t, b, "index", "draft")
		dn, _ := b.GetNote(draft)
		rec := get("/pages/" + dn.Alias + ".html")
		if !strings.Contains(rec.Body.String(), "まだ公開処理を行っていません") {
			t.Errorf("body = %q, want the not-published page", rec.Body.String())
		}
	})
}

// TestHandPlacedErrorPage は登録の無い docs/404.html（手で置いたもの）もプレビューサーバが使うことを検証する
func TestHandPlacedErrorPage(t *testing.T) {
	b := test.CreateBinder(t, "error_page_by_hand")
	defer b.Close()

	sys := b.GetFS()
	fp, err := sys.Create(filepath.Join(sys.GetPublic(), "404.html"))
	if err != nil {
		t.Fatalf("Create(404.html) error: %v", err)
	}
	fp.Write([]byte("hand placed"))
	fp.Close()

	h, err := b.PreviewHandler()
	if err != nil {
		t.Fatalf("PreviewHandler() error: %v", err)
	}
	for _, path := range []string{"/404.html", "/missing.txt"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if !strings.Contains(rec.Body.String(), "hand placed") {
			t.Errorf("GET %s body = %q, want the hand placed 404.html", path, rec.Body.String())
		}
	}
}
