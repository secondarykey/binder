package api

import "fmt"

func (a *App) Commit(noteId string, dataId string, auto bool) error {

	err := a.current.SaveCommit(noteId, dataId, auto)
	if err != nil {
		return fmt.Errorf("Commit() error\n%+v", err)
	}
	return nil
}

func (a *App) Remotes() ([]string, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	remotes, err := a.current.GetRemotes()
	if err != nil {
		return nil, fmt.Errorf("GetRemotes() error: %+v", err)
	}
	return remotes, nil
}

func (a *App) AddRemote(name string, url string) error {

	if a.current == nil {
		return fmt.Errorf("Not Open Binder")
	}

	err := a.current.CreateRemote(name, url)
	if err != nil {
		return fmt.Errorf("CreateRemote() error: %+v", err)
	}
	return nil
}
