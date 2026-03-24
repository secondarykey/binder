package setup

import (
	"binder/settings"
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

// installThemes はデフォルトテーマを ~/.binder/themes/_default/ に配置する。
// force=false の場合、各ファイルが既に存在すればスキップする。
// force=true の場合、常に上書きする。
func installThemes(force bool) error {

	dir := settings.DefaultThemesDirPath()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return xerrors.Errorf("os.MkdirAll(%s) error: %w", dir, err)
	}

	files := []string{"dark.css", "light.css"}
	for _, name := range files {
		p := filepath.Join(dir, name)
		if !force {
			if _, err := os.Stat(p); err == nil {
				continue
			}
		}

		data, err := embFs.ReadFile("_assets/themes/" + name)
		if err != nil {
			return xerrors.Errorf("embFs.ReadFile(%s) error: %w", name, err)
		}

		if err := os.WriteFile(p, data, 0644); err != nil {
			return xerrors.Errorf("os.WriteFile(%s) error: %w", p, err)
		}
	}

	return nil
}

// installLanguages はデフォルト言語ファイルを ~/.binder/languages/_default/ に配置する。
// force=false の場合、各ファイルが既に存在すればスキップする。
// force=true の場合、常に上書きする。
func installLanguages(force bool) error {

	dir := settings.DefaultLanguagesDirPath()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return xerrors.Errorf("os.MkdirAll(%s) error: %w", dir, err)
	}

	files := []string{"en.json", "ja.json"}
	for _, name := range files {
		p := filepath.Join(dir, name)
		if !force {
			if _, err := os.Stat(p); err == nil {
				continue
			}
		}

		data, err := embFs.ReadFile("_assets/languages/" + name)
		if err != nil {
			return xerrors.Errorf("embFs.ReadFile(%s) error: %w", name, err)
		}

		if err := os.WriteFile(p, data, 0644); err != nil {
			return xerrors.Errorf("os.WriteFile(%s) error: %w", p, err)
		}
	}

	return nil
}

// UpdateDefaults はデフォルトテーマ・言語ファイルを強制的に最新に上書きする。
// 開発モード起動時およびマイグレーション実行時に呼ばれる。
func UpdateDefaults() error {
	if err := installThemes(true); err != nil {
		return xerrors.Errorf("installThemes(force) error: %w", err)
	}
	if err := installLanguages(true); err != nil {
		return xerrors.Errorf("installLanguages(force) error: %w", err)
	}
	return nil
}
