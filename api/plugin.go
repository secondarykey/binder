package api

import (
	"binder/fs"
	"binder/log"
)

func (a *App) GetPlugins(engine string) ([]fs.PluginInfo, error) {
	defer log.PrintTrace(log.Func("GetPlugins()"))
	if a.current == nil {
		return []fs.PluginInfo{}, nil
	}
	return a.current.GetPlugins(engine)
}
