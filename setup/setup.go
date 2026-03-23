package setup

import (
	. "binder/internal"
	"binder/settings"

	"golang.org/x/xerrors"
)

// このパッケージは
// 起動時にアプリ設定が存在するか？や移行処理が
// 必要かの有無を判定ものです。
func EnsureExists(ver *Version) error {

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
	return nil
}
