package setup

import (
	"path/filepath"

	"binder/db"
	"binder/fs"
	. "binder/internal"
	"binder/setup/convert"

	"golang.org/x/xerrors"
)

// CheckConvert はバインダーのスキーマ移行が必要かを判定する。
// binder.json（または旧 schema.version）のバージョンと現在のアプリバージョンを比較し、
// 移行が必要な場合に true を返す。
func CheckConvert(dir string, ver *Version) (bool, error) {

	meta, err := loadBinderMeta(dir)
	if err != nil {
		return false, xerrors.Errorf("loadBinderMeta() error: %w", err)
	}

	ov, err := NewVersion(meta.Version)
	if err != nil {
		return false, xerrors.Errorf("version parse error: %w", err)
	}

	// 旧バージョンがアプリバージョンより古ければ移行が必要
	return ov.Lt(ver), nil
}

// Convert はバインダーのスキーマ移行を実行する。
// FileSystem を開いて setup/convert.Run() に委譲し、
// CSV スキーマ変換 + FS 移行 + binder.json 更新 + git コミットを行う。
func Convert(dir string, ver *Version) error {

	bfs, err := fs.Load(dir)
	if err != nil {
		return xerrors.Errorf("fs.Load() error: %w", err)
	}
	defer bfs.Close()

	dbDir := filepath.Join(dir, fs.DBDir)

	if err := convert.Run(dir, dbDir, ver, bfs); err != nil {
		return xerrors.Errorf("convert.Run() error: %w", err)
	}

	return nil
}

// loadBinderMeta は binder.json を読み込む。
// 存在しない場合は旧 db/schema.version からフォールバックする。
func loadBinderMeta(dir string) (*fs.BinderMeta, error) {
	meta, err := fs.LoadMeta(dir)
	if err != nil {
		return nil, err
	}
	if meta != nil {
		return meta, nil
	}

	// binder.json が存在しない場合、旧フォーマットからバージョンを取得
	dbDir := filepath.Join(dir, fs.DBDir)
	ver, err := db.SchemaVersion(dbDir)
	if err != nil {
		// どちらも存在しない場合は 0.0.0 として扱う
		return &fs.BinderMeta{Version: "0.0.0"}, nil
	}
	return &fs.BinderMeta{Version: ver.String()}, nil
}
