package api

import (
	"binder/db/model"
	"fmt"
)

func (a *App) EditConfig(conf *model.Config) (*model.Config, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	err := a.current.EditConfig(conf)
	if err != nil {
		return nil, fmt.Errorf("EditConfig() error\n%+v", err)
	}
	return conf, nil
}

func (a *App) GetConfig() (*model.Config, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	conf, err := a.current.GetConfig()
	if err != nil {
		return nil, fmt.Errorf("GetConfig() error\n%+v", err)
	}
	return conf, nil
}
