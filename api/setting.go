package api

import (
	"binder"
	"binder/log"
	"binder/settings"
	"fmt"
)

func (a *App) GetSetting() *settings.Setting {

	defer log.PrintTrace(log.Func("GetSetting()"))

	obj := settings.Get()
	if obj == nil {
		log.PrintStackTrace(fmt.Errorf("setting is nil"))
	}
	return obj
}

func (a *App) SaveSetting(s *settings.Setting) error {

	defer log.PrintTrace(log.Func("SaveSettings()"))

	err := a.current.SaveSetting(s)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("SaveSetting() error:\n%+v", err)
	}
	return nil
}

func (a *App) SavePosition() error {

	defer log.PrintTrace(log.Func("SetPosition()"))

	w, h := a.runtime.WindowSize()
	x, y := a.runtime.WindowPosition()

	obj := settings.Get()
	if obj == nil {
		log.PrintStackTrace(fmt.Errorf("setting is nil"))
	} else {

		pos := obj.Position
		pos.Left = x
		pos.Top = y
		pos.Width = w
		pos.Height = h

		err := a.current.SaveSetting(obj)
		if err != nil {
			log.PrintStackTrace(err)
			return fmt.Errorf("SaveSetting() error:\n%+v", err)
		}
	}
	return nil
}

func (a *App) GetFontNames() ([]string, error) {
	names := binder.FontNames()
	return names, nil
}
