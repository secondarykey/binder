package api

import (
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

	//w, h := runtime.WindowGetSize(a.ctx)
	//x, y := runtime.WindowGetPosition(a.ctx)

	//fmt.Println(x, y, w, h)

	return nil
}
