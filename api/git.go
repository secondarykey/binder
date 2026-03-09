package api

import (
	"binder"
	"binder/api/json"
	"binder/fs"
	"binder/log"

	"errors"
	"fmt"

	"golang.org/x/xerrors"
)

func (a *App) OpenModifiedWindow() error {

	defer log.PrintTrace(log.Func("OpenModifiedWindow()"))

	return a.runtime.OpenModifiedWindow()
}

func (a *App) CommitFiles(leafs []*json.Leaf, m string) error {

	files := make([]string, len(leafs))
	for idx, leaf := range leafs {
		f := a.current.ToFile(leaf.Type, leaf.Id)
		files[idx] = f
	}
	err := a.current.CommitFiles(m, files...)
	if err != nil {
		if !errors.Is(err, fs.UpdatedFilesError) {
			return xerrors.Errorf("Commit() error: %+v", err)
		}
		return fs.UpdatedFilesError
	}
	return nil
}

func (a *App) Commit(mode string, id string, m string) error {

	defer log.PrintTrace(log.Func("Commit()", id, mode))

	f := a.current.ToFile(mode, id)
	err := a.current.CommitFiles(m, f)
	if err != nil {
		if !errors.Is(err, fs.UpdatedFilesError) {
			return xerrors.Errorf("Commit() error: %+v", err)
		}
		return fs.UpdatedFilesError
	}
	return nil
}

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

func (a *App) GetNowPatch(typ string, id string) (*binder.Patch, error) {

	defer log.PrintTrace(log.Func("GetLatestPatch()", typ, id))

	p, err := a.current.GetNowPatch(typ, id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetLatestPath() error: %+v", err)
	}
	return p, nil
}
