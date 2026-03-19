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
