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

// CleanupInfo は履歴クリーンアップの統計情報
type CleanupInfo struct {
	TotalCommits int    `json:"totalCommits"`
	OldestCommit string `json:"oldestCommit"` // RFC3339
	NewestCommit string `json:"newestCommit"` // RFC3339
	BranchName   string `json:"branchName"`
	SquashTarget int    `json:"squashTarget"` // 圧縮対象コミット数
	KeepTarget   int    `json:"keepTarget"`   // 保持対象コミット数
	ObjectsSize  int64  `json:"objectsSize"`  // .git/objects サイズ（バイト）
}

// CleanupResult は履歴クリーンアップの実行結果
type CleanupResult struct {
	Status     string `json:"status"`     // success, error, reload_error
	Message    string `json:"message"`
	Address    string `json:"address"`
	BeforeSize int64  `json:"beforeSize"` // 実行前 .git/objects サイズ（バイト）
	AfterSize  int64  `json:"afterSize"`  // 実行後 .git/objects サイズ（バイト）
}

// GCResult はGC実行結果
type GCResult struct {
	BeforeSize int64 `json:"beforeSize"` // GC 前の .git/objects サイズ（バイト）
	AfterSize  int64 `json:"afterSize"`  // GC 後の .git/objects サイズ（バイト）
}

// CommitFileEntry はコミット内の変更ファイル1件
type CommitFileEntry struct {
	Typ    string `json:"typ"`    // note, diagram, asset, template
	Id     string `json:"id"`
	Action string `json:"action"` // added, modified, deleted
	Name   string `json:"name"`   // 表示名（Structure から解決）
}
