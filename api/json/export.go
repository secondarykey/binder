package json

// ExportDeps はノートZIPエクスポート時に不足しているリソースの情報を返す。
type ExportDeps struct {
	ExpandedMarkdown string          `json:"expandedMarkdown"`
	MissingDiagrams  []ExportDiagram `json:"missingDiagrams"`
}

// ExportDiagram はフロントエンドでSVG生成が必要なダイアグラムの情報。
type ExportDiagram struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}
