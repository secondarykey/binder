package json

// PublishRef はノートが参照している、まだ公開していない図・アセット・レイヤー。
// ノートを公開するときに、一緒に公開するかをユーザに選んでもらうために返す。
type PublishRef struct {
	Id   string `json:"id"`
	Type string `json:"type"` // "diagram" / "asset" / "layer"（structures の type）
	Name string `json:"name"`
	// StyleTemplate は図のスタイルテンプレートの ID（図のみ）。フロントで SVG を作るときに使う
	StyleTemplate string `json:"styleTemplate"`
}
