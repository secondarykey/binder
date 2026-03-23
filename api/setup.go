package api

import (
	"binder/settings"
	"binder/setup"

	"golang.org/x/xerrors"
)

func (a *App) Setup() (*settings.Setting, error) {

	err := setup.EnsureExists(a.version, a.devMode)
	if err != nil {
		return nil, xerrors.Errorf("setup.EnsureExists() error: %w", err)
	}

	set := settings.Get()
	return set, nil
}

func (a *App) CheckCompat(dir string) (*setup.CompatResult, error) {
	return setup.CheckCompat(dir, a.version)
}

func (a *App) Convert(dir string) error {
	return setup.Convert(dir, a.version)
}
