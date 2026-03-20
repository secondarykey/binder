package setup

import (
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
func Convert(dir string, ver *Version) error {
	if err := convert.Run(dir, ver); err != nil {
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
	return meta, nil
}
