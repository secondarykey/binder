package fs

import (
	"encoding/json"
	"io"
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
	Version    string `json:"version"`
	Name       string `json:"name,omitempty"`
	Detail     string `json:"detail,omitempty"`
	MarkedURL  string `json:"markedUrl,omitempty"`
	MermaidURL string `json:"mermaidUrl,omitempty"`
	Schema     string `json:"schema,omitempty"` // deprecated: 0.3.2未満との後方互換用。新規書き込み時は空にする
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

// SaveMeta はbinder.jsonを書き込む。
// FileSystem インスタンスがない場合（マイグレーション等）に使用する。
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

// LoadMetaData はbinder.jsonを読み込む。
// ファイルが存在しない場合は nil, nil を返す（エラーなし）。
func (f *FileSystem) LoadMetaData() (*BinderMeta, error) {
	fp, err := f.fs.Open(BinderMetaFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, xerrors.Errorf("Open(%s) error: %w", BinderMetaFile, err)
	}
	defer fp.Close()

	data, err := io.ReadAll(fp)
	if err != nil {
		return nil, xerrors.Errorf("ReadAll(%s) error: %w", BinderMetaFile, err)
	}

	var meta BinderMeta
	if err = json.Unmarshal(data, &meta); err != nil {
		return nil, xerrors.Errorf("json.Unmarshal() error: %w", err)
	}
	return &meta, nil
}

// SaveMetaData はbinder.jsonを書き込む。
func (f *FileSystem) SaveMetaData(meta *BinderMeta) error {
	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return xerrors.Errorf("json.MarshalIndent() error: %w", err)
	}

	fp, err := f.fs.OpenFile(BinderMetaFile, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return xerrors.Errorf("OpenFile(%s) error: %w", BinderMetaFile, err)
	}
	defer fp.Close()

	if _, err = fp.Write(data); err != nil {
		return xerrors.Errorf("Write(%s) error: %w", BinderMetaFile, err)
	}
	return nil
}
