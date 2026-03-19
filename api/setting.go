package api

import (
	"binder"
	"binder/log"
	"binder/settings"
	"fmt"
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

func (a *App) GetFontNames() ([]string, error) {
	names := binder.FontNames()
	return names, nil
}
