package api

import (
	"binder"
	"binder/log"
	"binder/settings"
	"fmt"

	"golang.org/x/xerrors"
)

func (a *App) LoadBinder(dir string) error {

	defer log.PrintTrace(log.Func("LoadBinder()"))

	err := a.load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("load() error\n%+v", err)
	}
	return nil
}

func (a *App) load(dir string) error {

	if dir == "" {
		return xerrors.Errorf("empty directory error")
	}

	s := settings.Get()
	b, err := binder.Load(dir)
	if err != nil {
		return xerrors.Errorf("Binder Load() error: %w", err)
	}
	err = b.Serve()
	if err != nil {
		return xerrors.Errorf("Binder Serve() error: %w", err)
	}
	a.SetCurrent(b)

	//履歴に追加
	s.Path.AddHistory(dir)
	err = s.Save()
	if err != nil {
		log.PrintStackTrace(err)
	}
	return nil
}

func (a *App) CloseBinder() error {

	defer log.PrintTrace(log.Func("CloseBinder()"))

	if a.current != nil {
		err := a.current.Close()
		a.current = nil

		if err != nil {
			log.PrintStackTrace(err)
			return fmt.Errorf("binder Close() error\n%+v", err)
		}
	}
	return nil
}

func (a *App) CreateBinder(dir string, name string) error {

	defer log.PrintTrace(log.Func("CreateBinder()"))

	err := binder.Install(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("binder Install error\n%+v", err)
	}

	err = a.load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("binder load error\n%+v", err)
	}

	err = a.current.Initialize(name)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("binder Initialize() error\n%+v", err)
	}

	return nil
}

func (a *App) CreateRemoteBinder(url string, dir string) error {

	defer log.PrintTrace(log.Func("CreateRemoteBinder()"))

	err := binder.CreateRemote(url, dir)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("CreateRemote() error\n%+v", err)
	}

	err = a.load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("load() error\n%+v", err)
	}

	return nil
}
