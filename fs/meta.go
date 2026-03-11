package fs

import (
	"encoding/json"
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

// BinderMetaFile はbinder.jsonのファイル名
const BinderMetaFile = "binder.json"

// BinderMeta はbinderディレクトリのメタ情報（binder.json）
// 0.3.2以降はappバージョンのみで管理し、schemaフィールドは廃止。
// 0.4.5以降はconfig.csvを廃止し、name/detailをbinder.jsonで管理する。
type BinderMeta struct {
	Version string `json:"version"`
	Name    string `json:"name,omitempty"`
	Detail  string `json:"detail,omitempty"`
	Schema  string `json:"schema,omitempty"` // deprecated: 0.3.2未満との後方互換用。新規書き込み時は空にする
}

// LoadMeta はbinder.jsonを読み込む。
// ファイルが存在しない場合は nil, nil を返す（エラーなし）。
func LoadMeta(dir string) (*BinderMeta, error) {
	p := filepath.Join(dir, BinderMetaFile)

	data, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, xerrors.Errorf("os.ReadFile() error: %w", err)
	}

	var meta BinderMeta
	if err = json.Unmarshal(data, &meta); err != nil {
		return nil, xerrors.Errorf("json.Unmarshal() error: %w", err)
	}
	return &meta, nil
}

// SaveMeta はbinder.jsonを書き込む
func SaveMeta(dir string, meta *BinderMeta) error {
	p := filepath.Join(dir, BinderMetaFile)

	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return xerrors.Errorf("json.MarshalIndent() error: %w", err)
	}

	if err = os.WriteFile(p, data, 0644); err != nil {
		return xerrors.Errorf("os.WriteFile() error: %w", err)
	}
	return nil
}
