// ユーザーレベルのスニペット（~/.binder/snippets.json）を管理する。
// スニペットはバインダーリポジトリではなくユーザーホームに保存され、
// 全バインダーで共有される。
package settings

import (
	"encoding/json"
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

// Snippet は単一のスニペット項目
type Snippet struct {
	Id   string `json:"id"`
	Name string `json:"name"`
	Body string `json:"body"`
}

// Snippets はsnippets.jsonのルート構造
type Snippets struct {
	Markdowns []Snippet `json:"markdowns"`
	Diagrams  []Snippet `json:"diagrams"`
	Templates []Snippet `json:"templates"`
}

// FilePath は~/.binder/snippets.json のパスを返す
func SnippetsFilePath() string {
	return filepath.Join(DirPath(), SnippetsFileName)
}

// Load は~/.binder/snippets.json を読み込む
func LoadSnippets() (*Snippets, error) {
	p := SnippetsFilePath()
	data, err := os.ReadFile(p)
	if err != nil {
		return nil, xerrors.Errorf("os.ReadFile(%s) error: %w", p, err)
	}

	var s Snippets
	if err = json.Unmarshal(data, &s); err != nil {
		return nil, xerrors.Errorf("json.Unmarshal() error: %w", err)
	}
	return &s, nil
}

// Save は~/.binder/snippets.json に書き込む
func SaveSnippets(s *Snippets) error {
	p := SnippetsFilePath()
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return xerrors.Errorf("json.MarshalIndent() error: %w", err)
	}
	if err = os.WriteFile(p, data, 0644); err != nil {
		return xerrors.Errorf("os.WriteFile(%s) error: %w", p, err)
	}
	return nil
}
