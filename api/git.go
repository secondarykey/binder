package api

import (
	"binder/fs"
	"binder/log"
	"errors"
	"fmt"
	"log/slog"

	"golang.org/x/xerrors"
)

func (a *App) Commit(mode string, id string, m string) error {

	defer log.PrintTrace(log.Func("Commit()", id, mode))

	var err error

	switch mode {
	case "note":
		err = a.current.CommitNote(id, m)
	case "diagram":
		err = a.current.CommitDiagram(id, m)
	case "template":
		err = a.current.CommitTemplate(id, m)
	case "assets":
		err = a.current.CommitAsset(id, m)
	default:
		slog.Warn("Unknown Mode:" + mode)
	}

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
