package binder_test

import (
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
