package api

import (
	"binder"
	"binder/fs"
	"binder/log"
	"binder/settings"
	"fmt"
	"strings"
)

func (a *App) SavePosition(pos *settings.Position) error {
	return settings.SavePosition(pos)
}

func (a *App) SaveFont(f *settings.Font) error {
	return settings.SaveFont(f)
}

func (a *App) GetFont() *settings.Font {

	defer log.PrintTrace(log.Func("GetSetting()"))
	font := settings.GetFont()
	if font == nil {
		log.PrintStackTrace(fmt.Errorf("font is nil"))
	}
	return font
}

func (a *App) GetHistories() []string {
	defer log.PrintTrace(log.Func("GetHistories()"))
	histories := settings.GetHistories()
	if histories == nil {
		log.PrintStackTrace(fmt.Errorf("histories is nil"))
	}
	return histories
}

func (a *App) SaveHistory(h string) error {
	defer log.PrintTrace(log.Func("SaveHistory()"))
	return settings.SaveHistory(h)
}

func (a *App) GetPath() *settings.Path {
	return settings.GetPath()
}

func (a *App) SavePath(p *settings.Path) error {
	return settings.SaveBasePath(p)
}

func (a *App) GetTheme(theme string) string {
	defer log.PrintTrace(log.Func("GetTheme()"))
	s := settings.Get()
	return s.Look.Theme
}

func (a *App) SetTheme(theme string) error {
	defer log.PrintTrace(log.Func("SetTheme()"))
	return settings.SaveTheme(theme)
}

func (a *App) GetLanguage() string {
	defer log.PrintTrace(log.Func("GetLanguage()"))
	s := settings.Get()
	return s.Language
}

func (a *App) SetLanguage(lang string) error {
	defer log.PrintTrace(log.Func("SetLanguage()"))
	return settings.SaveLanguage(lang)
}

func (a *App) GetEditor() *settings.Editor {
	defer log.PrintTrace(log.Func("GetEditor()"))
	return settings.GetEditor()
}

func (a *App) SaveEditor(e *settings.Editor) error {
	defer log.PrintTrace(log.Func("SaveEditor()"))
	return settings.SaveEditor(e)
}

func (a *App) GetGit() *settings.Git {
	defer log.PrintTrace(log.Func("GetGit()"))
	return settings.GetGit()
}

func (a *App) SaveGit(g *settings.Git) error {
	defer log.PrintTrace(log.Func("SaveGit()"))
	return settings.SaveGit(g)
}

func (a *App) GetFontNames() ([]string, error) {
	names := binder.FontNames()
	return names, nil
}

// GetThemeList は利用可能なテーマ一覧を返す。
func (a *App) GetThemeList() ([]settings.ThemeInfo, error) {
	defer log.PrintTrace(log.Func("GetThemeList()"))
	return settings.ListThemes()
}

// GetThemeCSS は指定IDのテーマCSSを返す。
func (a *App) GetThemeCSS(id string) (string, error) {
	defer log.PrintTrace(log.Func("GetThemeCSS()"))
	return settings.ReadThemeCSS(id)
}

// GetLanguageList は利用可能な言語一覧を返す。
func (a *App) GetLanguageList() ([]settings.LanguageInfo, error) {
	defer log.PrintTrace(log.Func("GetLanguageList()"))
	return settings.ListLanguages()
}

// GetLanguageData は指定コードの言語JSONを返す。
func (a *App) GetLanguageData(code string) (string, error) {
	defer log.PrintTrace(log.Func("GetLanguageData()"))
	return settings.ReadLanguageJSON(code)
}

// IsGitBashPath はエディタ引数に {bfile} が含まれる場合に true を返す。
// コピーメニューで GitBash 形式パスを表示するかどうかの判定に使用する。
func (a *App) IsGitBashPath() bool {
	return strings.Contains(settings.GetEditor().Args, "{bfile}")
}

// GetGitBashFullPath は物理ファイルパスを GitBash 形式に変換して返す。
// fs.ToGitBash と同等の変換（例: "C:\path\to\file" → "/C/path/to/file"）。
func (a *App) GetGitBashFullPath(mode, id string) string {
	defer log.PrintTrace(log.Func("GetGitBashFullPath()", mode, id))
	fullPath := a.current.GetFullPath(mode, id)
	return fs.ToGitBash(fullPath)
}

// GetAllowedCDNs はスクリプト読み込みを許可するCDNドメイン一覧を返す。
func (a *App) GetAllowedCDNs() []string {
	defer log.PrintTrace(log.Func("GetAllowedCDNs()"))
	return settings.GetAllowedCDNs()
}

// SaveAllowedCDNs はスクリプト読み込みを許可するCDNドメイン一覧を保存する。
func (a *App) SaveAllowedCDNs(cdns []string) error {
	defer log.PrintTrace(log.Func("SaveAllowedCDNs()"))
	return settings.SaveAllowedCDNs(cdns)
}
