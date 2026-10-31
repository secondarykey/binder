package binder_test

import (
	"binder"
	"binder/test"
	"fmt"
	"testing"
)

// pagerNames は id のノートで prevNote / nextNote を評価し、「前|次」の名前で返す。
// root が空なら引数なし（バインダー全体）で呼ぶ。
func pagerNames(t *testing.T, b *binder.Binder, id, root string, local bool) string {
	t.Helper()
	n, err := b.GetNote(id)
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}
	arg := ""
	if root != "" {
		arg = fmt.Sprintf(` "%s"`, root)
	}
	elm := fmt.Sprintf(`{{ with prevNote%s }}{{ .Name }}{{ end }}|{{ with nextNote%s }}{{ .Name }}{{ end }}`, arg, arg)
	html, _, err := b.ParseNote(n, local, elm)
	if err != nil {
		t.Fatalf("ParseNote() error: %v", err)
	}
	return html
}

// TestPrevNextNote は prevNote / nextNote が、起点から深さ優先でたどった順で前後のノートを返し、
// 非公開のノートを飛ばすことを検証する。
func TestPrevNextNote(t *testing.T) {
	b := test.CreateBinder(t, "prev_next_note")
	defer b.Close()

	root := createDoctorNote(t, b, "root")
	a := createChildNote(t, b, root, "a")
	a1 := createChildNote(t, b, a, "a1")
	bb := createChildNote(t, b, root, "b")
	priv := createChildNote(t, b, root, "priv")
	c := createChildNote(t, b, root, "c")

	pn, err := b.GetNote(priv)
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}
	pn.Private = true
	if _, err := b.EditNote(pn, ""); err != nil {
		t.Fatalf("EditNote(private) error: %v", err)
	}

	for _, c := range []struct {
		id   string
		want string
	}{
		{root, "|a"},
		{a, "root|a1"},
		{a1, "a|b"},
		{bb, "a1|c"},
		{c, "b|"},
	} {
		if got := pagerNames(t, b, c.id, root, true); got != c.want {
			t.Errorf("preview %s: got %q, want %q", c.id, got, c.want)
		}
	}

	// 非公開のノート自身を開いたときは、そのノートを順番に入れて前後を返す
	if got, want := pagerNames(t, b, priv, root, true), "b|c"; got != want {
		t.Errorf("preview priv: got %q, want %q", got, want)
	}

	// 引数なしはバインダー全体。root の下だけ見れば同じ並びになる
	if got, want := pagerNames(t, b, a1, "", true), "a|b"; got != want {
		t.Errorf("preview a1 (whole binder): got %q, want %q", got, want)
	}

	// 起点の外にあるノートでは何も返さない
	other := createDoctorNote(t, b, "other")
	if got, want := pagerNames(t, b, other, root, true), "|"; got != want {
		t.Errorf("preview other: got %q, want %q", got, want)
	}
}

// TestPrevNextNotePublished は、公開時は公開中のノートだけを数えることを検証する。
func TestPrevNextNotePublished(t *testing.T) {
	b := test.CreateBinder(t, "prev_next_note_published")
	defer b.Close()

	root := createDoctorNote(t, b, "root")
	a := createChildNote(t, b, root, "a")
	createChildNote(t, b, root, "draft")
	c := createChildNote(t, b, root, "c")

	for _, id := range []string{root, c} {
		if _, err := b.PublishNote(id, []byte("<p>note</p>")); err != nil {
			t.Fatalf("PublishNote() error: %v", err)
		}
	}

	// a はまだ公開していないが、公開しようとしているノート自身は順番に入れる
	if got, want := pagerNames(t, b, a, root, false), "root|c"; got != want {
		t.Errorf("publish a: got %q, want %q", got, want)
	}
	if got, want := pagerNames(t, b, c, root, false), "root|"; got != want {
		t.Errorf("publish c: got %q, want %q", got, want)
	}
}

// TestPrevNextNoteSeqOrder は、seq が 2 桁になっても数の順で並ぶことを検証する。
func TestPrevNextNoteSeqOrder(t *testing.T) {
	b := test.CreateBinder(t, "prev_next_note_seq")
	defer b.Close()

	root := createDoctorNote(t, b, "root")
	ids := make([]string, 12)
	for i := range ids {
		ids[i] = createChildNote(t, b, root, fmt.Sprintf("n%02d", i+1))
	}

	if got, want := pagerNames(t, b, ids[8], root, true), "n08|n10"; got != want {
		t.Errorf("n09: got %q, want %q", got, want)
	}
	if got, want := pagerNames(t, b, ids[9], root, true), "n09|n11"; got != want {
		t.Errorf("n10: got %q, want %q", got, want)
	}
}
