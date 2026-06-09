package api

import (
	"binder/fs"
	"binder/i18n"
	"binder/log"
	"binder/settings"
	"fmt"
	"strings"
)

func (a *App) SavePosition(pos *settings.Position) error {
	return settings.SavePosition(pos)
}

func (a *App) SaveFont(theme string, f *settings.Font) error {
	return settings.SaveFont(theme, f)
}

func (a *App) GetFont(theme string) *settings.Font {

	defer log.PrintTrace(log.Func("GetFont()"))
	font := settings.GetFont(theme)
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
	if err := settings.SaveLanguage(lang); err != nil {
		return err
	}
	i18n.SetLanguage(lang)
	return nil
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

// 以下のメソッドは api/shared パッケージに移動:
// GetFontNames, GetThemeList, GetThemeCSS, GetLanguageList, GetLanguageData

func (a *App) GetTreeDisplayMode() string {
	return settings.GetTreeDisplayMode()
}

func (a *App) SetTreeDisplayMode(mode string) error {
	return settings.SaveTreeDisplayMode(mode)
}

func (a *App) GetTreeExpandTargets() bool {
	return settings.GetTreeExpandTargets()
}

func (a *App) SetTreeExpandTargets(v bool) error {
	return settings.SaveTreeExpandTargets(v)
}

func (a *App) SaveLastData(dataType, id string) error {
	return settings.SaveLastData(dataType, id)
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
