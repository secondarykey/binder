package api

import (
	"binder/fs"
	"binder/i18n"
	"binder/log"
	"fmt"
)

func (a *App) GetPlugins(engine string) ([]fs.PluginInfo, error) {
	defer log.PrintTrace(log.Func("GetPlugins()"))
	if a.current == nil {
		return []fs.PluginInfo{}, nil
	}
	return a.current.GetPlugins(engine)
}

func (a *App) ListPlugins(engine string) ([]fs.PluginInfo, error) {
	defer log.PrintTrace(log.Func("ListPlugins()"))
	if a.current == nil {
		return []fs.PluginInfo{}, nil
	}
	return a.current.ListPlugins(engine)
}

func (a *App) SavePlugin(engine, name, content string) error {
	defer log.PrintTrace(log.Func("SavePlugin()"))
	if a.current == nil {
		return fmt.Errorf("%s", i18n.T("go.error.noBinderOpen"))
	}
	if err := a.current.SavePlugin(engine, name, content); err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("SavePlugin() error\n%+v", err)
	}
	return nil
}

func (a *App) RemovePlugin(engine, name string) error {
	defer log.PrintTrace(log.Func("RemovePlugin()"))
	if a.current == nil {
		return fmt.Errorf("%s", i18n.T("go.error.noBinderOpen"))
	}
	if err := a.current.RemovePlugin(engine, name); err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("RemovePlugin() error\n%+v", err)
	}
	return nil
}

func (a *App) RenamePlugin(engine, oldName, newName string) error {
	defer log.PrintTrace(log.Func("RenamePlugin()"))
	if a.current == nil {
		return fmt.Errorf("%s", i18n.T("go.error.noBinderOpen"))
	}
	if err := a.current.RenamePlugin(engine, oldName, newName); err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("RenamePlugin() error\n%+v", err)
	}
	return nil
}
