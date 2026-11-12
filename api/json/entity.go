package json

import "binder/entity"

// バインダーの中身を表す型と定数の実体は binder/entity にある。
// ここは画面との受け渡しの名前（json.Note など）で使えるようにしているだけ。
// db・fs・setup はここではなく binder/entity を直接 import する（下の層が api 配下に依存しないため）。

type (
	Note      = entity.Note
	Diagram   = entity.Diagram
	Asset     = entity.Asset
	Layer     = entity.Layer
	Template  = entity.Template
	Structure = entity.Structure

	Status       = entity.Status
	TemplateType = entity.TemplateType
)

const (
	ErrorStatus   = entity.ErrorStatus
	LatestStatus  = entity.LatestStatus
	PrivateStatus = entity.PrivateStatus
	UpdatedStatus = entity.UpdatedStatus

	NothingStatus  = entity.NothingStatus
	ModifiedStatus = entity.ModifiedStatus
)

const (
	LayoutTemplateType  = entity.LayoutTemplateType
	ContentTemplateType = entity.ContentTemplateType
	DiagramTemplateType = entity.DiagramTemplateType
)

// ErrorPageAlias は 404 ページにするノートの alias（entity.ErrorPageAlias）。
const ErrorPageAlias = entity.ErrorPageAlias

// IsErrorPageAlias は 404 ページにするノートの alias かどうかを返す。
func IsErrorPageAlias(alias string) bool {
	return entity.IsErrorPageAlias(alias)
}

// Templates は種類ごとのテンプレートの一覧（テンプレート設定の画面向け）。
type Templates struct {
	Layouts  []*Template `json:"layouts"`
	Contents []*Template `json:"contents"`
	Diagrams []*Template `json:"diagrams"`
}
