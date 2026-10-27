package binder_test

import (
	"binder"
	"binder/api/json"
	"binder/test"
	"fmt"
	"testing"
)

// createChildNote は parentId の下にノートを作成して ID を返す。
func createChildNote(t *testing.T, b *binder.Binder, parentId, name string) string {
	t.Helper()
	n, err := b.EditNote(&json.Note{Name: name, ParentId: parentId}, "")
	if err != nil {
		t.Fatalf("EditNote() error: %v", err)
	}
	return n.Id
}

// childNotesNames は parent の childNotes（"seq" 指定）を名前の並びで返す。
func childNotesNames(t *testing.T, b *binder.Binder, parentId string, local bool) string {
	t.Helper()
	parent, err := b.GetNote(parentId)
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}
	elm := fmt.Sprintf(`{{ range childNotes -1 "%s" "seq" }}[{{ .Name }}]{{ end }}`, parentId)
	html, _, err := b.ParseNote(parent, local, elm)
	if err != nil {
		t.Fatalf("ParseNote() error: %v", err)
	}
	return html
}

// TestChildNotesSeqPublished は childNotes の "seq" 指定が、公開時は公開中のノートだけを返すことを検証する。
// 未公開のノートや、公開を取り下げたノートへのリンクを公開ページに作らないため。
func TestChildNotesSeqPublished(t *testing.T) {
	b := test.CreateBinder(t, "child_notes_seq")
	defer b.Close()

	parent := createDoctorNote(t, b, "parent")
	published := createChildNote(t, b, parent, "published")
	createChildNote(t, b, parent, "draft")
	withdrawn := createChildNote(t, b, parent, "withdrawn")

	for _, id := range []string{published, withdrawn} {
		if _, err := b.PublishNote(id, []byte("<p>note</p>")); err != nil {
			t.Fatalf("PublishNote() error: %v", err)
		}
	}
	if err := b.UnpublishNote(withdrawn); err != nil {
		t.Fatalf("UnpublishNote() error: %v", err)
	}

	if got, want := childNotesNames(t, b, parent, false), "[published]"; got != want {
		t.Errorf("publish: childNotes = %q, want %q", got, want)
	}
	// プレビューでは書きかけも並びを確かめられるよう、非公開以外をすべて出す
	if got, want := childNotesNames(t, b, parent, true), "[published][draft][withdrawn]"; got != want {
		t.Errorf("preview: childNotes = %q, want %q", got, want)
	}
}

// TestPublishBatch はまとめて公開するときに、HTML を作る前から同時に公開するものが
// 公開済みとして扱われ、途中で失敗したらまだ書き出していないものが元に戻ることを検証する。
func TestPublishBatch(t *testing.T) {
	b := test.CreateBinder(t, "publish_batch")
	defer b.Close()

	parent := createDoctorNote(t, b, "parent")
	first := createChildNote(t, b, parent, "first")
	second := createChildNote(t, b, parent, "second")

	batch, err := b.BeginPublish(parent, first, second)
	if err != nil {
		t.Fatalf("BeginPublish() error: %v", err)
	}

	// 親より後に書き出す子も、親の一覧に出る
	if got, want := childNotesNames(t, b, parent, false), "[first][second]"; got != want {
		t.Errorf("childNotes in batch = %q, want %q", got, want)
	}

	if _, _, err := b.PublishNoteStage(first, []byte("<p>first</p>")); err != nil {
		t.Fatalf("PublishNoteStage() error: %v", err)
	}
	batch.Done(first)

	if err := batch.Rollback(); err != nil {
		t.Fatalf("Rollback() error: %v", err)
	}

	for _, c := range []struct {
		id        string
		published bool
	}{
		{parent, false},
		{first, true},
		{second, false},
	} {
		s, err := b.GetStructure(c.id)
		if err != nil {
			t.Fatalf("GetStructure() error: %v", err)
		}
		if got := !s.Republish.IsZero(); got != c.published {
			t.Errorf("%s: published = %v, want %v", s.Name, got, c.published)
		}
		if !c.published && !s.Publish.IsZero() {
			t.Errorf("%s: publish_date = %v, want zero", s.Name, s.Publish)
		}
	}
}
