package convert

import (
	"os"
	"path/filepath"

	"binder/db"
	"binder/fs"
	. "binder/internal"

	"golang.org/x/xerrors"
)

// loadMeta はbinder.jsonを読み込む。存在しない場合は旧バージョンのschema.versionから読み込む。
// binder.json の読み書き自体は fs.LoadMeta / fs.SaveMeta が担う。
// このラッパーは移行処理専用で、旧フォーマットへのフォールバックを追加する。
func loadMeta(dir string) (*fs.BinderMeta, error) {
	meta, err := fs.LoadMeta(dir)
	if err != nil {
		return nil, err
	}
	if meta == nil {
		return loadMetaFromLegacy(dir)
	}
	return meta, nil
}

// loadMetaFromLegacy は旧バージョンのdb/schema.versionからメタ情報を生成する
func loadMetaFromLegacy(dir string) (*fs.BinderMeta, error) {
	dbDir := filepath.Join(dir, "db")
	ver, err := db.SchemaVersion(dbDir)
	if err != nil {
		return &fs.BinderMeta{Version: "0.0.0"}, nil
	}
	return &fs.BinderMeta{Version: ver.String()}, nil
}

// schemaVersion はメタ情報のバージョン文字列を Version として返す。
// 0.3.2以降はappバージョン（Version）でスキーマも管理する。
func schemaVersion(meta *fs.BinderMeta) (*Version, error) {
	v, err := NewVersion(meta.Version)
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
