// Package defaults は、アプリ共通の既定アセット（テーマ・言語・Lite のプレビュー・
// 同梱プラグイン）を ~/.binder へ配置する。
//
// Binder と Binder Lite の両方が使う。Lite は git も DB も持たないので、このパッケージは
// binder/settings と binder/log だけを import する。binder（ルート）・db・fs・setup を
// import すると、Lite のバイナリに go-git と csvq が入る（setup から分けた理由）。
// バインダーの作成・移行は setup パッケージ側にある。
package defaults

import (
	"binder/settings"
	"embed"
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

//go:embed _assets
var embFs embed.FS

// InstallThemes はデフォルトテーマを ~/.binder/themes/_default/ に配置する。
// force=false の場合、各ファイルが既に存在すればスキップする。
// force=true の場合、常に上書きする。
func InstallThemes(force bool) error {

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

// InstallLanguages はデフォルト言語ファイルを ~/.binder/languages/_default/ に配置する。
// force=false の場合、各ファイルが既に存在すればスキップする。
// force=true の場合、常に上書きする。
func InstallLanguages(force bool) error {

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

// InstallLiteAssets はデフォルトの lite プレビューテンプレート・CSS を ~/.binder/lite/_default/ に配置する。
func InstallLiteAssets(force bool) error {

	dir := settings.DefaultLiteDirPath()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return xerrors.Errorf("os.MkdirAll(%s) error: %w", dir, err)
	}

	files := []string{"template.html", "preview-dark.css", "preview-light.css"}
	for _, name := range files {
		p := filepath.Join(dir, name)
		if !force {
			if _, err := os.Stat(p); err == nil {
				continue
			}
		}

		data, err := embFs.ReadFile("_assets/lite/" + name)
		if err != nil {
			return xerrors.Errorf("embFs.ReadFile(%s) error: %w", name, err)
		}

		if err := os.WriteFile(p, data, 0644); err != nil {
			return xerrors.Errorf("os.WriteFile(%s) error: %w", p, err)
		}
	}

	return nil
}

// InstallPlugins はデフォルトプラグインテンプレートを ~/.binder/plugins/_default/{engine}/ に配置する。
func InstallPlugins(force bool) error {

	engines := []string{"marked"}
	files := map[string][]string{
		"marked": {"example.js"},
	}

	for _, engine := range engines {
		dir := filepath.Join(settings.DefaultPluginsDirPath(), engine)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return xerrors.Errorf("os.MkdirAll(%s) error: %w", dir, err)
		}

		for _, name := range files[engine] {
			p := filepath.Join(dir, name)
			if !force {
				if _, err := os.Stat(p); err == nil {
					continue
				}
			}

			data, err := embFs.ReadFile("_assets/plugins/" + engine + "/" + name)
			if err != nil {
				return xerrors.Errorf("embFs.ReadFile(%s/%s) error: %w", engine, name, err)
			}

			if err := os.WriteFile(p, data, 0644); err != nil {
				return xerrors.Errorf("os.WriteFile(%s) error: %w", p, err)
			}
		}
	}

	return nil
}

// InstallSamplePlugins は 0.12.0 移行時に _assets/plugins/marked/ のサンプルプラグイン（example.js 除く）を
// ~/.binder/plugins/marked/ にインストールする。既にファイルが存在する場合はスキップする。
func InstallSamplePlugins() error {

	dir := settings.PluginsEngineDirPath("marked")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return xerrors.Errorf("os.MkdirAll(%s) error: %w", dir, err)
	}

	// example.js は参考用テンプレートのため除外
	skip := map[string]bool{"example.js": true}

	entries, err := embFs.ReadDir("_assets/plugins/marked")
	if err != nil {
		return xerrors.Errorf("embFs.ReadDir error: %w", err)
	}

	for _, e := range entries {
		if e.IsDir() || skip[e.Name()] {
			continue
		}
		p := filepath.Join(dir, e.Name())
		if _, err := os.Stat(p); err == nil {
			// 既に存在する場合はスキップ
			continue
		}
		data, err := embFs.ReadFile("_assets/plugins/marked/" + e.Name())
		if err != nil {
			return xerrors.Errorf("embFs.ReadFile(%s) error: %w", e.Name(), err)
		}
		// SyncSamplePlugins の突き合わせと揃えるため LF で置く（normalizeNewlines 参照）
		if err := os.WriteFile(p, normalizeNewlines(data), 0644); err != nil {
			return xerrors.Errorf("os.WriteFile(%s) error: %w", p, err)
		}
	}

	return nil
}

// Update はデフォルトテーマ・言語・lite テンプレート・プラグインテンプレートを強制的に最新に上書きする。
// 開発モード起動時およびマイグレーション実行時に呼ばれる。
func Update() error {
	if err := InstallThemes(true); err != nil {
		return xerrors.Errorf("InstallThemes(force) error: %w", err)
	}
	if err := InstallLanguages(true); err != nil {
		return xerrors.Errorf("InstallLanguages(force) error: %w", err)
	}
	if err := InstallLiteAssets(true); err != nil {
		return xerrors.Errorf("InstallLiteAssets(force) error: %w", err)
	}
	if err := InstallPlugins(true); err != nil {
		return xerrors.Errorf("InstallPlugins(force) error: %w", err)
	}
	return nil
}
