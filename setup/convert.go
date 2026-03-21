package setup

import (
	"binder/fs"
	. "binder/internal"
	"binder/settings"
	"binder/setup/convert"
	"log/slog"
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

// CompatStatus はバインダーとアプリのバージョン互換性の状態を表す。
type CompatStatus int

const (
	// CompatOK はバージョンが一致しており、そのまま開ける。
	CompatOK CompatStatus = iota
	// CompatNeedConvert はバインダーがアプリより古く、データ移行が必要。
	CompatNeedConvert
	// CompatNeedUpdate はバインダーがアプリより新しく、アプリの更新が必要。
	CompatNeedUpdate
)

// CompatResult はバインダーとアプリのバージョン比較結果を返す。
type CompatResult struct {
	Status        CompatStatus `json:"status"`
	AppVersion    string       `json:"appVersion"`
	BinderVersion string       `json:"binderVersion"`
}

// CheckCompat はバインダーとアプリのバージョン互換性を判定する。
// binder.json のバージョンとアプリバージョンを比較し、CompatResult を返す。
func CheckCompat(dir string, ver *Version) (*CompatResult, error) {

	meta, err := loadBinderMeta(dir)
	if err != nil {
		return nil, xerrors.Errorf("loadBinderMeta() error: %w", err)
	}

	ov, err := NewVersion(meta.Version)
	if err != nil {
		return nil, xerrors.Errorf("version parse error: %w", err)
	}

	result := &CompatResult{
		AppVersion:    ver.String(),
		BinderVersion: ov.String(),
	}

	switch {
	case ov.Lt(ver):
		result.Status = CompatNeedConvert
	case ov.Gt(ver):
		result.Status = CompatNeedUpdate
	default:
		result.Status = CompatOK
	}

	return result, nil
}

// Convert はバインダーのスキーマ移行を実行する。
func Convert(dir string, ver *Version) error {
	if err := convert.Run(dir, ver); err != nil {
		return xerrors.Errorf("convert.Run() error: %w", err)
	}

	// ユーザデータが存在しない場合は作成する（既存バインダーへの後方互換）
	userPath := filepath.Join(dir, fs.UserFileName)
	if _, err := os.Stat(userPath); os.IsNotExist(err) {
		key, err := GetUserKey()
		if err != nil {
			slog.Warn("Convert: GetUserKey", "Error", err)
		} else {
			s := settings.Get()
			info := &fs.UserInfo{
				Name:  s.Git.Name,
				Email: s.Git.Mail,
			}
			if err = fs.SaveUserInfo(dir, key, info); err != nil {
				slog.Warn("Convert: SaveUserInfo", "Error", err)
			}
		}
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
