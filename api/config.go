package api

import (
	"binder/db/model"
	"binder/log"
	"fmt"
)

func (a *App) EditConfig(conf *model.Config) (*model.Config, error) {

	defer log.PrintTrace(log.Func("EditConfig()"))

	err := a.current.EditConfig(conf)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("EditConfig() error\n%+v", err)
	}
	return conf, nil
}

func (a *App) GetConfig() (*model.Config, error) {

	defer log.PrintTrace(log.Func("GetConfig()"))

	conf, err := a.current.GetConfig()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetConfig() error\n%+v", err)
	}
	return conf, nil
}
