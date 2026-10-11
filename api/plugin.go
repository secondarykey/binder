package api

import (
	"binder/fs"
	"binder/log"
	"binder/settings"
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
		return fmt.Errorf("%s", settings.T("go.error.noBinderOpen"))
	}
	if err := a.current.SavePlugin(engine, name, content); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) RemovePlugin(engine, name string) error {
	defer log.PrintTrace(log.Func("RemovePlugin()"))
	if a.current == nil {
		return fmt.Errorf("%s", settings.T("go.error.noBinderOpen"))
	}
	if err := a.current.RemovePlugin(engine, name); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

// GetPluginVerifiedMajors は開いているバインダーのプラグイン検証時 marked メジャーを
// { プラグイン名: メジャー } で返す。未オープン時は空。
func (a *App) GetPluginVerifiedMajors(engine string) map[string]int {
	defer log.PrintTrace(log.Func("GetPluginVerifiedMajors()"))
	if a.current == nil {
		return map[string]int{}
	}
	return a.current.GetPluginVerified(engine)
}

// SetPluginVerifiedMajor はプラグインの検証時 marked メジャーを記録する。
// フロントエンドがプラグイン保存後、そのとき動作している marked のメジャーを渡す。
func (a *App) SetPluginVerifiedMajor(engine, name string, major int) error {
	defer log.PrintTrace(log.Func("SetPluginVerifiedMajor()"))
	if a.current == nil {
		return nil
	}
	if err := a.current.SetPluginVerified(engine, name, major); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) RenamePlugin(engine, oldName, newName string) error {
	defer log.PrintTrace(log.Func("RenamePlugin()"))
	if a.current == nil {
		return fmt.Errorf("%s", settings.T("go.error.noBinderOpen"))
	}
	if err := a.current.RenamePlugin(engine, oldName, newName); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}
