package api

import (
	"binder/api/json"
	"binder/log"
	"fmt"
)

func (a *App) EditConfig(conf *json.Config) (*json.Config, error) {

	defer log.PrintTrace(log.Func("EditConfig()"))

	err := a.current.EditConfig(conf)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("EditConfig() error\n%+v", err)
	}
	return conf, nil
}

func (a *App) GetConfig() (*json.Config, error) {

	defer log.PrintTrace(log.Func("GetConfig()"))

	conf, err := a.current.GetConfig()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetConfig() error\n%+v", err)
	}
	return conf, nil
}

func (a *App) GetUserInfo() (*json.UserInfo, error) {

	defer log.PrintTrace(log.Func("GetUserInfo()"))

	info, err := a.current.GetUserInfo()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetUserInfo() error\n%+v", err)
	}
	return info, nil
}

func (a *App) EditUserInfo(info *json.UserInfo) (*json.UserInfo, error) {

	defer log.PrintTrace(log.Func("EditUserInfo()"))

	err := a.current.EditUserInfo(info)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("EditUserInfo() error\n%+v", err)
	}
	return info, nil
}
