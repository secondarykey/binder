package binder_test

import (
	"binder/test"
	"testing"
)

// TestResolveLinkPath はプレビュー内のバインダー内リンクの解決を検証する
func TestResolveLinkPath(t *testing.T) {
	b := test.CreateBinder(t, "resolve_link_path")
	defer b.Close()

	id := getFirstNoteId(t, b)
	s, err := b.GetStructure(id)
	if err != nil {
		t.Fatalf("GetStructure(%q) error: %v", id, err)
	}
	if s.Alias == "" {
		t.Skip("note has no alias")
	}

	t.Run("note", func(t *testing.T) {
		got, err := b.ResolveLinkPath("/pages/" + s.Alias + ".html")
		if err != nil {
			t.Fatalf("ResolveLinkPath() error: %v", err)
		}
		if got == nil {
			t.Fatal("ResolveLinkPath() returned nil, want the note structure")
		}
		if got.Id != id {
			t.Errorf("ResolveLinkPath().Id = %q, want %q", got.Id, id)
		}
	})

	t.Run("unknown alias", func(t *testing.T) {
		got, err := b.ResolveLinkPath("/pages/no-such-alias.html")
		if err != nil {
			t.Fatalf("ResolveLinkPath() error: %v", err)
		}
		if got != nil {
			t.Errorf("ResolveLinkPath() = %v, want nil", got)
		}
	})

	t.Run("not an entity path", func(t *testing.T) {
		// エンティティURLでないパスはエラーにせず nil を返す
		for _, path := range []string{"/", "/style.css", "/pages/", "/images/x.png"} {
			got, err := b.ResolveLinkPath(path)
			if err != nil {
				t.Fatalf("ResolveLinkPath(%q) error: %v", path, err)
			}
			if got != nil {
				t.Errorf("ResolveLinkPath(%q) = %v, want nil", path, got)
			}
		}
	})
}
