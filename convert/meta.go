package convert

import (
	"encoding/json"
	"os"
	"path/filepath"

	"binder/db"
	. "binder/internal"

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

// LoadMeta はbinder.jsonを読み込む。存在しない場合は旧バージョンのschema.versionから読み込む
func LoadMeta(dir string) (*BinderMeta, error) {
	p := filepath.Join(dir, BinderMetaFile)

	data, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return loadMetaFromLegacy(dir)
		}
		return nil, xerrors.Errorf("os.ReadFile() error: %w", err)
	}

	var meta BinderMeta
	if err = json.Unmarshal(data, &meta); err != nil {
		return nil, xerrors.Errorf("json.Unmarshal() error: %w", err)
	}
	return &meta, nil
}

// loadMetaFromLegacy は旧バージョンのdb/schema.versionからメタ情報を生成する
func loadMetaFromLegacy(dir string) (*BinderMeta, error) {
	dbDir := filepath.Join(dir, "db")
	ver, err := db.SchemaVersion(dbDir)
	if err != nil {
		return &BinderMeta{Version: "0.0.0"}, nil
	}
	return &BinderMeta{Version: ver.String()}, nil
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

// schemaVersion はbinderのバージョンをVersionとして返す。
// 0.3.2以降はappバージョン（Version）でスキーマも管理する。
func (m *BinderMeta) schemaVersion() (*Version, error) {
	v, err := NewVersion(m.Version)
	if err != nil {
		return nil, xerrors.Errorf("version parse error: %w", err)
	}
	return v, nil
}

// removeOldSchemaFiles はbinder.jsonへの移行後に不要になった旧スキーマファイルを削除する
// db/schema.version と db/*_schema（旧旧フォーマット）が対象
func removeOldSchemaFiles(dir string) {
	dbDir := filepath.Join(dir, "db")

	// 現行の旧フォーマット: db/schema.version
	_ = os.Remove(filepath.Join(dbDir, db.SchemaFile))

	// 旧旧フォーマット: db/*_schema（例: 0.1.0_schema）
	matches, err := filepath.Glob(filepath.Join(dbDir, "*"+db.SchemaFileSuffix))
	if err != nil {
		return
	}
	for _, f := range matches {
		_ = os.Remove(f)
	}
}
