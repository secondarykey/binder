package json

// ParseResult はテンプレート展開・HTML生成の結果を返す。
// パース/テンプレートエラーはErrorフィールドに格納し、Go error としては返さない。
// テンプレート関数で発生した非致命的エラーはWarningsに蓄積される。
type ParseResult struct {
	HTML     string   `json:"html"`
	Error    string   `json:"error,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
}
