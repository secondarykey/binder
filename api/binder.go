package api

import (
	"binder"
	"binder/settings"
	"fmt"
	"log"
	"log/slog"

	"golang.org/x/xerrors"
)

func (a *App) LoadBinder(dir string) error {

	err := a.load(dir)
	if err != nil {
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
	a.SetCurrent(b)

	//履歴に追加
	s.Path.AddHistory(dir)
	err = s.Save()
	if err != nil {
		log.Println(err)
	}
	return nil
}

func (a *App) CloseBinder() error {

	if a.current != nil {
		err := a.current.Close()
		a.current = nil

		if err != nil {
			return fmt.Errorf("binder Close() error\n%+v", err)
		}
	}
	return nil
}

func (a *App) CreateBinder(dir string, name string, sample bool) error {

	err := binder.Install(dir, name, sample)
	if err != nil {
		rtn := fmt.Errorf("binder Install error\n%+v", err)
		slog.Error(err.Error())
		return rtn
	}

	err = a.load(dir)
	if err != nil {
		rtn := fmt.Errorf("binder load error\n%+v", err)
		slog.Error(err.Error())
		return rtn
	}

	err = a.current.Initialize()
	if err != nil {
		rtn := fmt.Errorf("binder Initialize() error\n%+v", err)
		slog.Error(err.Error())
		return rtn
	}

	return nil
}

func (a *App) CreateRemoteBinder(url string, dir string) error {

	err := binder.CreateRemote(url, dir)
	if err != nil {
		return fmt.Errorf("CreateRemote() error\n%+v", err)
	}

	err = a.load(dir)
	if err != nil {
		return fmt.Errorf("load() error\n%+v", err)
	}

	return nil
}

func (a *App) SaveSetting(s *settings.Setting) error {
	return a.current.SaveSetting(s)
}

func (a *App) GetSetting() *settings.Setting {
	return settings.Get()
}

func (a *App) GetBinderTree() (*binder.Tree, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	tree, err := a.current.GetBinderTree()
	if err != nil {
		return nil, fmt.Errorf("GetBinderTree() error\n%+v", err)
	}
	return tree, nil
}

func (a *App) GetTemplateTree() (*binder.Tree, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	tree, err := a.current.GetTemplateTree()
	if err != nil {
		return nil, fmt.Errorf("GetTemplateTree() error\n%+v", err)
	}

	return tree, nil
}
