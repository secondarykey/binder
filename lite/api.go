package lite

import (
	"binder/log"
	"binder/settings"
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

// App は binder-lite の Wails v3 Service。
// ファイルI/O とテーマ・言語の提供のみを担当する。
type App struct {
	version     string
	initialFile string
}

// New は App を生成する。
func New(version string) *App {
	return &App{version: version}
}

// SetInitialFile は起動時に開くファイルパスを設定する。
func (a *App) SetInitialFile(path string) {
	a.initialFile = path
}

// InitialFile は起動時に開くファイルパスを返す。空文字なら指定なし。
func (a *App) InitialFile() string {
	return a.initialFile
}

// Version はアプリバージョンを返す。
func (a *App) Version() string {
	return a.version
}

// ReadFile は指定パスのファイル内容をテキストとして返す。
func (a *App) ReadFile(path string) (string, error) {
	defer log.PrintTrace(log.Func("ReadFile()", path))

	data, err := os.ReadFile(path)
	if err != nil {
		return "", xerrors.Errorf("ReadFile(%s) error: %w", path, err)
	}
	return string(data), nil
}

// SaveFile は指定パスにテキストを書き込む。
// アトミック書き込み（一時ファイル→リネーム）で安全に保存する。
func (a *App) SaveFile(path, content string) error {
	defer log.PrintTrace(log.Func("SaveFile()", path))

	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".binder-lite-*.tmp")
	if err != nil {
		return xerrors.Errorf("CreateTemp() error: %w", err)
	}
	tmpName := tmp.Name()

	if _, err := tmp.WriteString(content); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return xerrors.Errorf("WriteString() error: %w", err)
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return xerrors.Errorf("Close() error: %w", err)
	}
	if err := os.Rename(tmpName, path); err != nil {
		os.Remove(tmpName)
		return xerrors.Errorf("Rename() error: %w", err)
	}
	return nil
}

// --- テーマ・言語（settings パッケージに委譲） ---

// GetTheme は現在のテーマIDを返す。
func (a *App) GetTheme() string {
	s := settings.Get()
	return s.Look.Theme
}

// SetTheme はテーマIDを保存する。
func (a *App) SetTheme(theme string) error {
	return settings.SaveTheme(theme)
}

// GetThemeList は利用可能なテーマ一覧を返す。
func (a *App) GetThemeList() ([]settings.ThemeInfo, error) {
	return settings.ListThemes()
}

// GetThemeCSS は指定IDのテーマCSSを返す。
func (a *App) GetThemeCSS(id string) (string, error) {
	return settings.ReadThemeCSS(id)
}

// GetLanguage は現在の言語コードを返す。
func (a *App) GetLanguage() string {
	s := settings.Get()
	return s.Language
}

// SetLanguage は言語コードを保存する。
func (a *App) SetLanguage(lang string) error {
	return settings.SaveLanguage(lang)
}

// GetLanguageList は利用可能な言語一覧を返す。
func (a *App) GetLanguageList() ([]settings.LanguageInfo, error) {
	return settings.ListLanguages()
}

// GetLanguageData は指定コードの言語JSONを返す。
func (a *App) GetLanguageData(code string) (string, error) {
	return settings.ReadLanguageJSON(code)
}
