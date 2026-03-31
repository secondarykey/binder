package json

// HistoryEntry はファイル履歴の1エントリを表す
type HistoryEntry struct {
	Hash    string `json:"hash"`
	Message string `json:"message"`
	When    string `json:"when"` // RFC3339
}

// HistoryPage はページネーション付き履歴レスポンス
type HistoryPage struct {
	Entries []*HistoryEntry `json:"entries"`
	HasMore bool            `json:"hasMore"`
}

// CommitFileEntry はコミット内の変更ファイル1件
type CommitFileEntry struct {
	Typ    string `json:"typ"`    // note, diagram, asset, template
	Id     string `json:"id"`
	Action string `json:"action"` // added, modified, deleted
	Name   string `json:"name"`   // 表示名（Structure から解決）
}
