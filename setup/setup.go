package setup

import (
	. "binder/internal"
	"binder/settings"
	"log/slog"

	"golang.org/x/xerrors"
)

// このパッケージは
// 起動時にアプリ設定が存在するか？や移行処理が
// 必要かの有無を判定ものです。
func EnsureExists(ver *Version, devMode bool) error {

	// ~/.binder ディレクトリと setting.json の確認・作成
	err := settings.EnsureDir()
	if err != nil {
		return xerrors.Errorf("settings.EnsureDir() error: %w", err)
	}

	// ~/.binder/snippets.json の確認・作成
	err = installSnippets()
	if err != nil {
		return xerrors.Errorf("installSnippets() error: %w", err)
	}

	// ~/.binder/themes/_default/ にデフォルトテーマを配置（存在しなければ）
	err = installThemes(false)
	if err != nil {
		return xerrors.Errorf("installThemes() error: %w", err)
	}

	// ~/.binder/languages/_default/ にデフォルト言語ファイルを配置（存在しなければ）
	err = installLanguages(false)
	if err != nil {
		return xerrors.Errorf("installLanguages() error: %w", err)
	}

	//暗号化キーが存在しない場合
	if !isExistsUserKey() {
		err := setUserKey()
		if err != nil {
			return xerrors.Errorf("setUserKey() error: %w", err)
		}
	}

	// アプリレベルのバージョンアップ処理
	if err := migrateApp(ver, devMode); err != nil {
		return xerrors.Errorf("migrateApp() error: %w", err)
	}

	return nil
}

// migrateApp はアプリのバージョンアップ時にデフォルトテーマ・言語ファイルを最新に更新する。
// 開発モードの場合は常に更新し、通常モードではバージョンが変わった場合のみ更新する。
// appVersion が空（この機能導入前の既存ユーザー）の場合は 0.8.5 とみなす。
func migrateApp(ver *Version, devMode bool) error {

	prev := settings.GetAppVersion()
	if prev == "" {
		prev = "0.8.5"
	}
	prevVer, err := NewVersion(prev)
	if err != nil {
		return xerrors.Errorf("NewVersion(%s) error: %w", prev, err)
	}

	needUpdate := devMode || !prevVer.Eq(ver)

	if needUpdate {
		if err := UpdateDefaults(); err != nil {
			slog.Warn("migrateApp: UpdateDefaults", "Error", err)
		}
	}

	// EnsureExists 終了時点で常に現在のバージョンを記録する
	if !prevVer.Eq(ver) {
		if err := settings.SaveAppVersion(ver.String()); err != nil {
			return xerrors.Errorf("settings.SaveAppVersion() error: %w", err)
		}
	}

	return nil
}
