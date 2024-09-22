package api

import (
	"binder/log"
	"fmt"
)

func (a *App) Remotes() ([]string, error) {

	defer log.PrintTrace(log.Func("Remotes()"))

	remotes, err := a.current.GetRemotes()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetRemotes() error: %+v", err)
	}
	return remotes, nil
}

func (a *App) AddRemote(name string, url string) error {

	defer log.PrintTrace(log.Func("AddRemote()"))

	err := a.current.CreateRemote(name, url)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("CreateRemote() error: %+v", err)
	}
	return nil
}
