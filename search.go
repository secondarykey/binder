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

// Search はバインダー内の全ノート・ダイアグラム・アセット・テンプレートを検索する。
// 一致するファイルが見つかるたびに onResult コールバックを呼び出す。
func (b *Binder) Search(ctx context.Context, query string, onResult func(SearchResult)) {
	if b == nil || query == "" {
		return
	}

	queryLower := strings.ToLower(query)

	// ノート・ダイアグラム・アセット（structures テーブル）
	structures, err := b.db.FindStructures()
	if err != nil {
		log.Warn("Search: FindStructures error:\n%+v", err)
		return
	}

	for _, s := range structures {
		select {
		case <-ctx.Done():
			return
		default:
		}

		var content string
		switch s.Typ {
		case "note":
			var buf bytes.Buffer
			if err = b.ReadNote(&buf, s.Id); err == nil {
				content = buf.String()
			}
		case "diagram":
			var buf bytes.Buffer
			if err = b.ReadDiagram(&buf, s.Id); err == nil {
				content = buf.String()
			}
		case "asset":
			a, err := b.db.GetAsset(s.Id)
			if err != nil || a.Binary {
				// バイナリアセットは名前のみ対象
				content = ""
			} else {
				data, _, err := b.ReadAssetBytes(s.Id)
				if err == nil {
					content = string(data)
				}
			}
		default:
			continue
		}

		if result, ok := matchContent(s.Id, s.Typ, s.Name, content, queryLower); ok {
			onResult(result)
		}
	}

	// テンプレート（templates テーブル）
	templates, err := b.db.FindTemplates()
	if err != nil {
		log.Warn("Search: FindTemplates error:\n%+v", err)
		return
	}

	for _, tmpl := range templates {
		select {
		case <-ctx.Done():
			return
		default:
		}

		var buf bytes.Buffer
		var content string
		if err = b.ReadTemplate(&buf, tmpl.Id); err == nil {
			content = buf.String()
		}

		if result, ok := matchContent(tmpl.Id, "template", tmpl.Name, content, queryLower); ok {
			onResult(result)
		}
	}
}

// matchContent は名前と内容を検索し、一致があれば SearchResult を返す。
func matchContent(id, typ, name, content, queryLower string) (SearchResult, bool) {
	var matches []SearchMatch

	if strings.Contains(strings.ToLower(name), queryLower) {
		matches = append(matches, SearchMatch{Line: 0, Content: name})
	}

	for i, line := range strings.Split(content, "\n") {
		if strings.Contains(strings.ToLower(line), queryLower) {
			if len(line) > 200 {
				line = line[:200] + "…"
			}
			matches = append(matches, SearchMatch{Line: i + 1, Content: line})
		}
	}

	if len(matches) == 0 {
		return SearchResult{}, false
	}
	return SearchResult{Id: id, Typ: typ, Name: name, Matches: matches}, true
}
