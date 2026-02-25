package binder

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
type BinderMeta struct {
	Version string `json:"version"`
	Schema  string `json:"schema"`
}

// loadMeta はbinder.jsonを読み込む。存在しない場合は旧バージョンのschema.versionから読み込む
func loadMeta(dir string) (*BinderMeta, error) {
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
		return &BinderMeta{Version: "0.0.0", Schema: "0.0.0"}, nil
	}
	return &BinderMeta{Version: ver.String(), Schema: ver.String()}, nil
}

// saveMeta はbinder.jsonを書き込む
func saveMeta(dir string, meta *BinderMeta) error {
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

// schemaVersion はBinderMetaのスキーマバージョンをVersionとして返す
func (m *BinderMeta) schemaVersion() (*Version, error) {
	v, err := NewVersion(m.Schema)
	if err != nil {
		return nil, xerrors.Errorf("schema version parse error: %w", err)
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
