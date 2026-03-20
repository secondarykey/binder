package api

import (
	"binder/settings"
	"binder/setup"

	"github.com/pkg/errors"
)

func (a *App) Setup() (*settings.Setting, error) {

	err := setup.EnsureExists()
	if err != nil {
		return nil, errors.Errorf("setup.EnsureExists() error: %w", err)
	}

	set := settings.Get()
	return set, nil
}
