package api

import (
	"binder/api/json"
	"binder/log"
)

func (a *App) EditConfig(conf *json.Config) (*json.Config, error) {

	defer log.PrintTrace(log.Func("EditConfig()"))

	err := a.current.EditConfig(conf)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return conf, nil
}

func (a *App) GetConfig() (*json.Config, error) {

	defer log.PrintTrace(log.Func("GetConfig()"))

	conf, err := a.current.GetConfig()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return conf, nil
}

func (a *App) GetPublishSettings() (*json.PublishSettings, error) {

	defer log.PrintTrace(log.Func("GetPublishSettings()"))

	publishOnly, publishBranch, publishSubDir, err := a.current.GetPublishSettings()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return &json.PublishSettings{
		PublishOnly:   publishOnly,
		PublishBranch: publishBranch,
		PublishSubDir: publishSubDir,
	}, nil
}

func (a *App) GetUserInfo() (*json.UserInfo, error) {

	defer log.PrintTrace(log.Func("GetUserInfo()"))

	info, err := a.current.GetUserInfo()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return info, nil
}

func (a *App) EditUserInfo(info *json.UserInfo) (*json.UserInfo, error) {

	defer log.PrintTrace(log.Func("EditUserInfo()"))

	err := a.current.EditUserInfo(info)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return info, nil
}
