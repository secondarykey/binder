package setup

import (
	"errors"
	"path/filepath"

	"binder/db"
	"binder/fs"
	. "binder/internal"
	"binder/log"
	"binder/settings"
	"binder/setup/convert"

	"github.com/go-git/go-git/v5"
	"golang.org/x/xerrors"
)

// CompatStatus はバインダーとアプリのバージョン互換性の状態を表す。
type CompatStatus int

const (
	// CompatOK はバージョンが一致しており、そのまま開ける。
	CompatOK CompatStatus = iota
	// CompatNeedConvert はバインダーがアプリより古く、データ移行が必要。
	CompatNeedConvert
	// CompatNeedUpdate はバインダーがアプリより新しく、アプリの更新が必要（minAppVersion未設定の旧バインダー）。
	CompatNeedUpdate
	// CompatVersionOnly はバインダーがアプリより古いが、スキーマ移行不要でバージョン更新のみ必要。
	CompatVersionOnly
	// CompatTooOld はアプリが minAppVersion を満たしておらず、バインダーを開けない。
	CompatTooOld
	// CompatNotBinder はディレクトリがバインダーではない。
	CompatNotBinder
	// CompatBinderTooOld はバインダーが古すぎて移行できない
	//（convert.MinSupportedBinderVersion 未満。旧移行コードは削除済みのため、
	// 旧バージョンのアプリで一度開いて移行する必要がある）。
	CompatBinderTooOld
)

// CompatResult はバインダーとアプリのバージョン比較結果を返す。
type CompatResult struct {
	Status        CompatStatus `json:"status"`
	AppVersion    string       `json:"appVersion"`
	BinderVersion string       `json:"binderVersion"`
	MinAppVersion string       `json:"minAppVersion,omitempty"`
	// MinBinderVersion はこのアプリが移行できる最小のバインダーバージョン
	//（CompatBinderTooOld の場合に設定される）。
	MinBinderVersion string `json:"minBinderVersion,omitempty"`
}

// CheckCompat はバインダーとアプリのバージョン互換性を判定する。
// binder.json のバージョンとアプリバージョンを比較し、CompatResult を返す。
func CheckCompat(dir string, ver *Version) (*CompatResult, error) {

	// gitリポジトリでなければバインダーではない
	if _, err := git.PlainOpen(dir); err != nil {
		return &CompatResult{
			Status:     CompatNotBinder,
			AppVersion: ver.String(),
		}, nil
	}

	meta, err := loadBinderMeta(dir)
	if err != nil {
		if errors.Is(err, convert.ErrNotBinder) {
			return &CompatResult{
				Status:     CompatNotBinder,
				AppVersion: ver.String(),
			}, nil
		}
		return nil, xerrors.Errorf("loadBinderMeta() error: %w", err)
	}

	ov, err := NewVersion(meta.Version)
	if err != nil {
		return nil, xerrors.Errorf("version parse error: %w", err)
	}

	result := &CompatResult{
		AppVersion:    ver.String(),
		BinderVersion: ov.String(),
		MinAppVersion: meta.MinAppVersion,
	}

	switch {
	case ov.Lt(ver):
		// 最小サポートバージョン未満のバインダーは移行できない
		//（旧移行コードは削除済み。NeedsMigration 判定より先にチェックする）
		minVer, minErr := NewVersion(convert.MinSupportedBinderVersion)
		if minErr == nil && ov.Lt(minVer) {
			result.Status = CompatBinderTooOld
			result.MinBinderVersion = convert.MinSupportedBinderVersion
			break
		}
		if convert.NeedsMigration(ov) {
			result.Status = CompatNeedConvert
		} else {
			result.Status = CompatVersionOnly
		}
	case ov.Gt(ver):
		if meta.MinAppVersion != "" {
			minVer, err := NewVersion(meta.MinAppVersion)
			if err == nil {
				if ver.Lt(minVer) {
					result.Status = CompatTooOld
				} else {
					// minAppVersion を満たしているのでスキーマ互換。変換なしで開ける。
					result.Status = CompatOK
				}
				break
			}
		}
		// minAppVersion 未設定（旧バインダー）: 従来通り警告ダイアログ
		result.Status = CompatNeedUpdate
	default:
		result.Status = CompatOK
	}

	return result, nil
}

// Convert はバインダーのスキーマ移行を実行する。
func Convert(dir string, ver *Version) error {
	result, err := convert.Run(dir, ver)
	if err != nil {
		return xerrors.Errorf("convert.Run() error: %w", err)
	}

	// 0.7.2 移行時: ユーザデータを初期作成する
	if result.UserDataRequired {
		key, err := GetUserKey()
		if err != nil {
			log.Warn("Convert: GetUserKey:\n%+v", err)
		} else {
			s := settings.Get()
			info := &fs.UserInfo{
				Name:  s.Git.Name,
				Email: s.Git.Mail,
			}
			if err = fs.SaveUserInfo(dir, key, info); err != nil {
				log.Warn("Convert: SaveUserInfo:\n%+v", err)
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
	if meta == nil {
		// binder.json が存在しない場合は db/schema.version にフォールバック
		dbDir := filepath.Join(dir, "db")
		ver, err := db.SchemaVersion(dbDir)
		if err != nil {
			return nil, convert.ErrNotBinder
		}
		return &fs.BinderMeta{Version: ver.String()}, nil
	}
	return meta, nil
}
