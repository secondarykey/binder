package binder

import (
	"sort"
	"time"

	"binder/api/json"

	"golang.org/x/xerrors"
)

// GetUnpublishedRefs は、ノートを公開したときに参照先が 404 になる図・アセット・レイヤーを返す。
//
// 本文（text はエディタ上の Markdown）とレイアウト・コンテンツテンプレートの両方で参照しているものを、
// エクスポートの依存関係の収集（exportDeps）と同じ仕組みで集める。レイヤーは下敷きの画像も含む。
// 返すのはまだ一度も公開していないものだけ。非公開（private）のものは公開できないので含めない
// （公開時の警告で知らせる）。ノートへのリンクは別のページなので対象外。
func (b *Binder) GetUnpublishedRefs(noteId string, text string) ([]*json.PublishRef, error) {

	if b == nil {
		return nil, EmptyError
	}

	note, err := b.GetNote(noteId)
	if err != nil {
		return nil, xerrors.Errorf("GetNote() error: %w", err)
	}

	// 本文から参照しているもの
	_, deps, err := b.ParseNoteForExport(note, text)
	if err != nil {
		return nil, xerrors.Errorf("ParseNoteForExport() error: %w", err)
	}
	// レイアウト・コンテンツテンプレートから参照しているもの（CSS・ファビコン等）。
	// 本文の HTML は参照の収集に要らないので空で渡す
	_, layoutDeps, err := b.CreateNoteHTMLForExport(note, "")
	if err != nil {
		return nil, xerrors.Errorf("CreateNoteHTMLForExport() error: %w", err)
	}
	deps.merge(layoutDeps)

	return unpublishedRefs(deps), nil
}

// unpublishedRefs は収集した依存関係から、公開が必要なものを図・アセット・レイヤーの順、名前順で返す。
func unpublishedRefs(d *exportDeps) []*json.PublishRef {

	needs := func(private bool, republish time.Time) bool {
		return !private && republish.IsZero()
	}

	var diagrams, assets, layers []*json.PublishRef
	for id, diag := range d.diagrams {
		if needs(diag.Private, diag.Republish) {
			diagrams = append(diagrams, &json.PublishRef{Id: id, Type: "diagram", Name: diag.Name, StyleTemplate: diag.StyleTemplate})
		}
	}
	for id, a := range d.assets {
		if needs(a.Private, a.Republish) {
			assets = append(assets, &json.PublishRef{Id: id, Type: "asset", Name: a.Name})
		}
	}
	for id, l := range d.layers {
		if needs(l.Private, l.Republish) {
			layers = append(layers, &json.PublishRef{Id: id, Type: "layer", Name: l.Name})
		}
	}

	byName := func(list []*json.PublishRef) {
		sort.Slice(list, func(i, j int) bool {
			if list[i].Name != list[j].Name {
				return list[i].Name < list[j].Name
			}
			return list[i].Id < list[j].Id
		})
	}
	byName(diagrams)
	byName(assets)
	byName(layers)

	rtn := make([]*json.PublishRef, 0, len(diagrams)+len(assets)+len(layers))
	rtn = append(rtn, diagrams...)
	rtn = append(rtn, assets...)
	rtn = append(rtn, layers...)
	return rtn
}
