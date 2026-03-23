package setup

import (
	"binder/settings"
	"os"

	"golang.org/x/xerrors"
)

// installThemes はデフォルトテーマを ~/.binder/themes/_default/ に配置する。
// _default/ のファイルはシステム管理のため、常に最新に上書きする。
func installThemes() error {

	dir := settings.DefaultThemesDirPath()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return xerrors.Errorf("os.MkdirAll(%s) error: %w", dir, err)
	}

	files := []string{"dark.css", "light.css"}
	for _, name := range files {
		data, err := embFs.ReadFile("_assets/themes/" + name)
		if err != nil {
			return xerrors.Errorf("embFs.ReadFile(%s) error: %w", name, err)
		}

		p := settings.DefaultThemesDirPath() + string(os.PathSeparator) + name
		if err := os.WriteFile(p, data, 0644); err != nil {
			return xerrors.Errorf("os.WriteFile(%s) error: %w", p, err)
		}
	}

	return nil
}

// installLanguages はデフォルト言語ファイルを ~/.binder/languages/_default/ に配置する。
// _default/ のファイルはシステム管理のため、常に最新に上書きする。
func installLanguages() error {

	dir := settings.DefaultLanguagesDirPath()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return xerrors.Errorf("os.MkdirAll(%s) error: %w", dir, err)
	}

	files := []string{"en.json", "ja.json"}
	for _, name := range files {
		data, err := embFs.ReadFile("_assets/languages/" + name)
		if err != nil {
			return xerrors.Errorf("embFs.ReadFile(%s) error: %w", name, err)
		}

		p := settings.DefaultLanguagesDirPath() + string(os.PathSeparator) + name
		if err := os.WriteFile(p, data, 0644); err != nil {
			return xerrors.Errorf("os.WriteFile(%s) error: %w", p, err)
		}
	}

	return nil
}
