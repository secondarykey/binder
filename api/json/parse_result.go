package json

// ParseResult はテンプレート展開・HTML生成の結果を返す。
// パース/テンプレートエラーはErrorフィールドに格納し、Go error としては返さない。
// テンプレート関数で発生した非致命的エラーはWarningsに蓄積される。
// ErrorLine はエディタ内容のテンプレートエラー行番号（1始まり）。0 はエラー行不明。
type ParseResult struct {
	HTML      string   `json:"html"`
	Error     string   `json:"error,omitempty"`
	ErrorLine int      `json:"errorLine,omitempty"`
	Warnings  []string `json:"warnings,omitempty"`
}
