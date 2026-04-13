package json

// GenerateItem は GenerateAll API に渡す公開対象アイテムを表す。
type GenerateItem struct {
	Mode string `json:"mode"` // "note", "diagram", "assets"
	Id   string `json:"id"`
	Data string `json:"data"` // note: レンダリング済みHTML, diagram: SVG文字列, asset: ""
}
