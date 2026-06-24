package api

import (
	"binder/log"
	"binder/settings"
	"fmt"
)

func (a *App) ListAppPlugins(engine string) ([]settings.AppPluginInfo, error) {
	defer log.PrintTrace(log.Func("ListAppPlugins()"))
	return settings.ListAppPlugins(engine)
}

func (a *App) SaveAppPlugin(engine, name, content string) error {
	defer log.PrintTrace(log.Func("SaveAppPlugin()"))
	if err := settings.SaveAppPlugin(engine, name, content); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) RemoveAppPlugin(engine, name string) error {
	defer log.PrintTrace(log.Func("RemoveAppPlugin()"))
	if err := settings.DeleteAppPlugin(engine, name); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) RenameAppPlugin(engine, oldName, newName string) error {
	defer log.PrintTrace(log.Func("RenameAppPlugin()"))
	if err := settings.RenameAppPlugin(engine, oldName, newName); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) InstallAppPlugin(engine, name string) error {
	defer log.PrintTrace(log.Func("InstallAppPlugin()"))
	if a.current == nil {
		return fmt.Errorf("%s", settings.T("go.error.noBinderOpen"))
	}
	if err := a.current.InstallAppPlugin(engine, name); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}
