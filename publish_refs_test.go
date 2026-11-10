package binder_test

import (
	"fmt"
	"testing"

	"binder/api/json"
	"binder/test"
)

// TestGetUnpublishedRefs は、ノートが参照しているまだ公開していない図・アセット・レイヤーを返すことを検証する。
// 公開済みのもの・非公開のもの・ノートへのリンクは返さない。
func TestGetUnpublishedRefs(t *testing.T) {
	b := test.CreateBinder(t, "unpublished_refs")
	defer b.Close()

	noteId := getFirstNoteId(t, b)

	tree, err := b.GetBinderTree()
	if err != nil {
		t.Fatalf("GetBinderTree() error: %v", err)
	}
	asset := findLeafByType(tree.Data, "asset")
	if asset == nil {
		t.Skip("no asset in binder tree")
	}

	diag := createDiagram(t, b)
	layer, err := b.EditLayer(&json.Layer{ParentId: asset.Id, Name: "TestLayer"})
	if err != nil {
		t.Fatalf("EditLayer() error: %v", err)
	}
	priv := createDiagram(t, b)
	priv.Private = true
	if _, err := b.EditDiagram(priv); err != nil {
		t.Fatalf("EditDiagram(private) error: %v", err)
	}

	text := fmt.Sprintf("{{ drawDiagram %q }}\n{{ drawLayer %q }}\n{{ drawDiagram %q }}\n{{ link %q }}",
		diag.Id, layer.Id, priv.Id, noteId)

	find := func(refs []*json.PublishRef, id string) *json.PublishRef {
		for _, r := range refs {
			if r.Id == id {
				return r
			}
		}
		return nil
	}

	refs, err := b.GetUnpublishedRefs(noteId, text)
	if err != nil {
		t.Fatalf("GetUnpublishedRefs() error: %v", err)
	}

	// 図・レイヤー・レイヤーの下敷きの画像
	want := map[string]string{diag.Id: "diagram", layer.Id: "layer", asset.Id: "asset"}
	for id, typ := range want {
		r := find(refs, id)
		if r == nil {
			t.Errorf("refs = %v, want %s %s", refs, typ, id)
			continue
		}
		if r.Type != typ {
			t.Errorf("ref(%s).Type = %q, want %q", id, r.Type, typ)
		}
	}
	if find(refs, priv.Id) != nil {
		t.Errorf("refs contain private diagram %s", priv.Id)
	}
	if find(refs, noteId) != nil {
		t.Errorf("refs contain linked note %s", noteId)
	}

	// 図・アセット・レイヤーの順に並ぶ
	order := map[string]int{"diagram": 0, "asset": 1, "layer": 2}
	for i := 1; i < len(refs); i++ {
		if order[refs[i-1].Type] > order[refs[i].Type] {
			t.Errorf("refs order: %s before %s", refs[i-1].Type, refs[i].Type)
		}
	}

	// 公開したものは返さない
	if _, err := b.PublishDiagram(diag.Id, []byte("<svg></svg>")); err != nil {
		t.Fatalf("PublishDiagram() error: %v", err)
	}
	if _, err := b.PublishAsset(asset.Id); err != nil {
		t.Fatalf("PublishAsset() error: %v", err)
	}
	if _, err := b.PublishLayer(layer.Id); err != nil {
		t.Fatalf("PublishLayer() error: %v", err)
	}
	refs, err = b.GetUnpublishedRefs(noteId, text)
	if err != nil {
		t.Fatalf("GetUnpublishedRefs() error: %v", err)
	}
	for id := range want {
		if find(refs, id) != nil {
			t.Errorf("refs = %v, want no %s after publishing", refs, id)
		}
	}
}

// TestGetUnpublishedRefsTemplate は、レイアウトテンプレートから参照しているアセット（CSS 等）も返すことを検証する。
func TestGetUnpublishedRefsTemplate(t *testing.T) {
	b := test.CreateBinder(t, "unpublished_refs_template")
	defer b.Close()

	noteId := getFirstNoteId(t, b)
	note, err := b.GetNote(noteId)
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}

	tree, err := b.GetBinderTree()
	if err != nil {
		t.Fatalf("GetBinderTree() error: %v", err)
	}
	asset := findLeafByType(tree.Data, "asset")
	if asset == nil {
		t.Skip("no asset in binder tree")
	}

	// レイアウトテンプレートでアセットを参照する
	layout := fmt.Sprintf(`<link rel="stylesheet" href="{{ assets %q }}">{{ template "Content" . }}`, asset.Id)
	if err := b.SaveTemplate(note.LayoutTemplate, []byte(layout)); err != nil {
		t.Fatalf("SaveTemplate() error: %v", err)
	}

	refs, err := b.GetUnpublishedRefs(noteId, "本文")
	if err != nil {
		t.Fatalf("GetUnpublishedRefs() error: %v", err)
	}
	found := false
	for _, r := range refs {
		if r.Id == asset.Id && r.Type == "asset" {
			found = true
		}
	}
	if !found {
		t.Errorf("refs = %v, want the asset %s referenced from the layout", refs, asset.Id)
	}
}
