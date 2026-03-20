package api

import (
	"binder/settings"
	"binder/setup"

	"golang.org/x/xerrors"
)

func (a *App) Setup() (*settings.Setting, error) {

	err := setup.EnsureExists(a.Version)
	if err != nil {
		return nil, xerrors.Errorf("setup.EnsureExists() error: %w", err)
	}

	set := settings.Get()
	return set, nil
}

func (a *App) CheckConvert(dir string) (bool, error) {
	return setup.CheckConvert(dir, a.version)
}

func (a *App) Convert(dir string) error {
	return setup.Convert(dir, a.version)
}
