package binder

import (
	"bytes"
	"context"
	"strings"

	"binder/log"
)

// SearchResult はファイル単位の検索結果
type SearchResult struct {
	Id      string        `json:"id"`
	Typ     string        `json:"type"`
	Name    string        `json:"name"`
	Matches []SearchMatch `json:"matches"`
}

// SearchMatch は行単位の一致情報
type SearchMatch struct {
	Line    int    `json:"line"`
	Content string `json:"content"`
}

// Search はバインダー内の全ノート・ダイアグラムを検索する。
// 一致するファイルが見つかるたびに onResult コールバックを呼び出す。
func (b *Binder) Search(ctx context.Context, query string, onResult func(SearchResult)) {
	if b == nil || query == "" {
		return
	}

	structures, err := b.db.FindStructures()
	if err != nil {
		log.WarnE("Search: FindStructures error", err)
		return
	}

	queryLower := strings.ToLower(query)

	for _, s := range structures {
		// キャンセルチェック
		select {
		case <-ctx.Done():
			return
		default:
		}

		// ノートとダイアグラムのみ対象
		if s.Typ != "note" && s.Typ != "diagram" {
			continue
		}

		// ファイル内容を読み込む
		var buf bytes.Buffer
		if s.Typ == "note" {
			err = b.ReadNote(&buf, s.Id)
		} else {
			err = b.ReadDiagram(&buf, s.Id)
		}
		if err != nil {
			continue
		}

		content := buf.String()
		var matches []SearchMatch

		// ファイル名での一致チェック
		nameLower := strings.ToLower(s.Name)
		if strings.Contains(nameLower, queryLower) {
			matches = append(matches, SearchMatch{
				Line:    0,
				Content: s.Name,
			})
		}

		// 内容を行ごとに検索
		lines := strings.Split(content, "\n")
		for i, line := range lines {
			if strings.Contains(strings.ToLower(line), queryLower) {
				displayLine := line
				if len(displayLine) > 200 {
					displayLine = displayLine[:200] + "…"
				}
				matches = append(matches, SearchMatch{
					Line:    i + 1,
					Content: displayLine,
				})
			}
		}

		if len(matches) > 0 {
			onResult(SearchResult{
				Id:      s.Id,
				Typ:     s.Typ,
				Name:    s.Name,
				Matches: matches,
			})
		}
	}
}
