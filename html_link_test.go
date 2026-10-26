package binder_test

import (
	"binder/api/json"
	"binder/test"
	"fmt"
	"strings"
	"testing"
)

// TestLinkFunc は link テンプレート関数を検証する
func TestLinkFunc(t *testing.T) {
	b := test.CreateBinder(t, "link_func")
	defer b.Close()

	tree, err := b.GetBinderTree()
	if err != nil {
		t.Fatalf("GetBinderTree() error: %v", err)
	}
	leaf := findNonIndexNote(tree.Data)
	if leaf == nil {
		t.Fatal("no non-index note found in binder tree")
	}

	note, err := b.GetNote(leaf.Id)
	if err != nil {
		t.Fatalf("GetNote(%q) error: %v", leaf.Id, err)
	}
	if note.Alias == "" {
		t.Skip("note has no alias")
	}
	// index 以外のノートは docs/pages/ 配下に出るため、相対プレフィックスは "../"
	wantHref := "../pages/" + note.Alias + ".html"

	t.Run("name omitted", func(t *testing.T) {
		elm := fmt.Sprintf(`{{ link "%s" }}`, note.Id)
		html, warnings, err := b.ParseNote(note, false, elm)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		want := fmt.Sprintf(`<a href="%s">%s</a>`, wantHref, note.Name)
		if html != want {
			t.Errorf("ParseNote() = %q, want %q", html, want)
		}
		// 未公開のノートへのリンクは、公開しても辿れないため警告する（リンク自体は出す）
		if !hasWarning(warnings, "not published yet") {
			t.Errorf("warnings = %v, want a not-published warning", warnings)
		}
	})

	t.Run("no publish warning in preview", func(t *testing.T) {
		elm := fmt.Sprintf(`{{ link "%s" }}`, note.Id)
		_, warnings, err := b.ParseNote(note, true, elm)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		if len(warnings) != 0 {
			t.Errorf("warnings = %v, want none", warnings)
		}
	})

	t.Run("name given", func(t *testing.T) {
		elm := fmt.Sprintf(`{{ link "%s" "表示名" }}`, note.Id)
		html, _, err := b.ParseNote(note, false, elm)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		want := fmt.Sprintf(`<a href="%s">表示名</a>`, wantHref)
		if html != want {
			t.Errorf("ParseNote() = %q, want %q", html, want)
		}
	})

	t.Run("diagram", func(t *testing.T) {
		// 種別ごとに関数を分けず、IDから裏で型を判定して出し分ける
		created := createDiagram(t, b)
		d, err := b.GetDiagram(created.Id)
		if err != nil {
			t.Fatalf("GetDiagram(%q) error: %v", created.Id, err)
		}

		elm := fmt.Sprintf(`{{ link "%s" }}`, d.Id)
		html, _, err := b.ParseNote(note, false, elm)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		want := fmt.Sprintf(`<a href="../images/%s.svg">%s</a>`, d.Alias, d.Name)
		if html != want {
			t.Errorf("ParseNote() = %q, want %q", html, want)
		}
	})

	t.Run("unknown id", func(t *testing.T) {
		html, warnings, err := b.ParseNote(note, false, `{{ link "no-such-id" }}`)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		// 壊れたリンクを出さず、プレビューに見えるエラーと警告を残す
		if strings.Contains(html, "<a ") {
			t.Errorf("ParseNote() = %q, want no anchor", html)
		}
		if !strings.Contains(html, "ERROR") {
			t.Errorf("ParseNote() = %q, want an error message", html)
		}
		if len(warnings) == 0 {
			t.Error("warnings = none, want one")
		}
	})

	t.Run("escapes the link text", func(t *testing.T) {
		elm := fmt.Sprintf(`{{ link "%s" "<script>" }}`, note.Id)
		html, _, err := b.ParseNote(note, false, elm)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		if strings.Contains(html, "<script>") {
			t.Errorf("ParseNote() = %q, want the text escaped", html)
		}
	})
}

func hasWarning(warnings []string, sub string) bool {
	for _, w := range warnings {
		if strings.Contains(w, sub) {
			return true
		}
	}
	return false
}

// TestURLFunc は url テンプレート関数を検証する
func TestURLFunc(t *testing.T) {
	b := test.CreateBinder(t, "url_func")
	defer b.Close()

	tree, err := b.GetBinderTree()
	if err != nil {
		t.Fatalf("GetBinderTree() error: %v", err)
	}
	leaf := findNonIndexNote(tree.Data)
	if leaf == nil {
		t.Fatal("no non-index note found in binder tree")
	}
	note, err := b.GetNote(leaf.Id)
	if err != nil {
		t.Fatalf("GetNote(%q) error: %v", leaf.Id, err)
	}
	if note.Alias == "" {
		t.Skip("note has no alias")
	}

	t.Run("returns the published URL", func(t *testing.T) {
		elm := fmt.Sprintf(`<meta content="{{ url "%s" }}">`, note.Id)
		html, _, err := b.ParseNote(note, false, elm)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		want := fmt.Sprintf(`<meta content="../pages/%s.html">`, note.Alias)
		if html != want {
			t.Errorf("ParseNote() = %q, want %q", html, want)
		}
	})

	t.Run("returns the same URL in preview", func(t *testing.T) {
		// モードで別物を返すとテンプレートを書く側が挙動を追えなくなる
		elm := fmt.Sprintf(`{{ url "%s" }}`, note.Id)
		publish, _, err := b.ParseNote(note, false, elm)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		preview, _, err := b.ParseNote(note, true, elm)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		if preview != publish {
			t.Errorf("preview = %q, publish = %q, want the same", preview, publish)
		}
	})

	t.Run("diagram", func(t *testing.T) {
		created := createDiagram(t, b)
		d, err := b.GetDiagram(created.Id)
		if err != nil {
			t.Fatalf("GetDiagram(%q) error: %v", created.Id, err)
		}

		elm := fmt.Sprintf(`{{ url "%s" }}`, d.Id)
		html, warnings, err := b.ParseNote(note, false, elm)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		want := fmt.Sprintf("../images/%s.svg", d.Alias)
		if html != want {
			t.Errorf("ParseNote() = %q, want %q", html, want)
		}
		// 公開しても辿れない先であることは伝える
		if !hasWarning(warnings, "not published yet") {
			t.Errorf("warnings = %v, want a not-published warning", warnings)
		}
	})

	t.Run("unknown id", func(t *testing.T) {
		html, warnings, err := b.ParseNote(note, false, `{{ url "no-such-id" }}`)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		if !strings.Contains(html, "ERROR") {
			t.Errorf("ParseNote() = %q, want an error message", html)
		}
		if len(warnings) == 0 {
			t.Error("warnings = none, want one")
		}
	})
}

// TestAssetsUnpublishedWarning は assets / assetsImage が未公開アセットを
// 参照した場合に警告することを検証する。
// プレビューでは data URI で綺麗に表示されるため、公開時にしか気付けない。
func TestAssetsUnpublishedWarning(t *testing.T) {
	b := test.CreateBinder(t, "assets_warning")
	defer b.Close()

	tree, err := b.GetBinderTree()
	if err != nil {
		t.Fatalf("GetBinderTree() error: %v", err)
	}
	leaf := findLeafByType(tree.Data, "asset")
	if leaf == nil {
		t.Skip("no asset in binder tree")
	}
	note, err := b.GetNote(getFirstNoteId(t, b))
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}

	for _, fn := range []string{"assets", "assetsImage"} {
		t.Run(fn, func(t *testing.T) {
			elm := fmt.Sprintf(`{{ %s "%s" }}`, fn, leaf.Id)

			_, warnings, err := b.ParseNote(note, false, elm)
			if err != nil {
				t.Fatalf("ParseNote() error: %v", err)
			}
			if !hasWarning(warnings, "not published yet") {
				t.Errorf("warnings = %v, want a not-published warning", warnings)
			}

			// プレビュー中は未公開が通常の状態なので警告しない
			_, warnings, err = b.ParseNote(note, true, elm)
			if err != nil {
				t.Fatalf("ParseNote() error: %v", err)
			}
			if hasWarning(warnings, "not published yet") {
				t.Errorf("warnings = %v, want no not-published warning in preview", warnings)
			}
		})
	}
}

// TestDrawUnpublishedWarning は drawDiagram / drawLayer が未公開の図・レイヤー・下敷きの画像を
// 参照した場合に警告することを検証する。
// 公開ページは公開済みの SVG・画像を参照するため、未公開だとその部分だけが 404 になる。
func TestDrawUnpublishedWarning(t *testing.T) {
	b := test.CreateBinder(t, "draw_warning")
	defer b.Close()

	note, err := b.GetNote(getFirstNoteId(t, b))
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}

	// parse は公開時の警告と、プレビュー時の警告を返す
	parse := func(t *testing.T, elm string) (publish, preview []string) {
		t.Helper()
		_, publish, err := b.ParseNote(note, false, elm)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		_, preview, err = b.ParseNote(note, true, elm)
		if err != nil {
			t.Fatalf("ParseNote() error: %v", err)
		}
		return publish, preview
	}

	t.Run("drawDiagram", func(t *testing.T) {
		d := createDiagram(t, b)
		elm := fmt.Sprintf(`{{ drawDiagram "%s" }}`, d.Id)

		publish, preview := parse(t, elm)
		if !hasWarning(publish, "drawDiagram("+d.Id+"): not published yet") {
			t.Errorf("warnings = %v, want a not-published warning", publish)
		}
		if hasWarning(preview, "not published yet") {
			t.Errorf("warnings = %v, want no not-published warning in preview", preview)
		}

		if _, err := b.PublishDiagram(d.Id, []byte("<svg></svg>")); err != nil {
			t.Fatalf("PublishDiagram() error: %v", err)
		}
		if publish, _ := parse(t, elm); hasWarning(publish, "not published yet") {
			t.Errorf("warnings = %v, want none after publishing", publish)
		}
	})

	t.Run("drawLayer", func(t *testing.T) {
		tree, err := b.GetBinderTree()
		if err != nil {
			t.Fatalf("GetBinderTree() error: %v", err)
		}
		asset := findLeafByType(tree.Data, "asset")
		if asset == nil {
			t.Skip("no asset in binder tree")
		}
		l, err := b.EditLayer(&json.Layer{ParentId: asset.Id, Name: "TestLayer"})
		if err != nil {
			t.Fatalf("EditLayer() error: %v", err)
		}
		elm := fmt.Sprintf(`{{ drawLayer "%s" }}`, l.Id)

		// レイヤーも下敷きの画像も未公開
		publish, preview := parse(t, elm)
		for _, id := range []string{l.Id, asset.Id} {
			if !hasWarning(publish, "drawLayer("+id+"): not published yet") {
				t.Errorf("warnings = %v, want a not-published warning for %s", publish, id)
			}
		}
		if hasWarning(preview, "not published yet") {
			t.Errorf("warnings = %v, want no not-published warning in preview", preview)
		}

		if _, err := b.PublishAsset(asset.Id); err != nil {
			t.Fatalf("PublishAsset() error: %v", err)
		}
		if _, err := b.PublishLayer(l.Id); err != nil {
			t.Fatalf("PublishLayer() error: %v", err)
		}
		if publish, _ := parse(t, elm); hasWarning(publish, "not published yet") {
			t.Errorf("warnings = %v, want none after publishing", publish)
		}
	})
}

// TestPublishScriptsWarning は、信頼していないバインダーで公開するページにスクリプトがあると
// 警告することを検証する。プレビューではスクリプトを止めているため、
// どう動くかを見ないまま公開することになる。
// テスト用のバインダーは信頼していない（setting.json に登録しない）前提。
func TestPublishScriptsWarning(t *testing.T) {
	b := test.CreateBinder(t, "publish_scripts")
	defer b.Close()

	note, err := b.GetNote(getFirstNoteId(t, b))
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}
	if b.IsTrusted() {
		t.Skip("test binder is trusted in setting.json")
	}

	const warn = "scripts(" // binder.ScriptsWarning
	for _, c := range []struct {
		name  string
		elm   string
		local bool
		want  bool
	}{
		{"script element", `<p>x</p><script>alert(1)</script>`, false, true},
		{"event handler attribute", `<img src="x.png" onerror="alert(1)">`, false, true},
		{"escaped text", `<pre><code>&lt;script&gt;</code></pre>`, false, false},
		// プレビューでは止めたことをアイコンで知らせるため、警告にはしない
		{"preview", `<script>alert(1)</script>`, true, false},
	} {
		t.Run(c.name, func(t *testing.T) {
			_, warnings, err := b.CreateNoteHTML(note, c.local, c.elm)
			if err != nil {
				t.Fatalf("CreateNoteHTML() error: %v", err)
			}
			if got := hasWarning(warnings, warn+note.Id+")"); got != c.want {
				t.Errorf("warnings = %v, want scripts warning = %v", warnings, c.want)
			}
		})
	}
}
