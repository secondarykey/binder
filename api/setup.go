package api

import (
	"fmt"

	"binder/log"
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

func (a *App) CheckCompat(dir string) (result *setup.CompatResult, err error) {
	// 予期しないパニックをエラーに変換してアプリのクラッシュを防ぐ
	defer func() {
		if r := recover(); r != nil {
			log.PrintStackTrace(fmt.Errorf("panic in CheckCompat: %v", r))
			err = fmt.Errorf("unexpected error checking compatibility: %v", r)
		}
	}()
	return setup.CheckCompat(dir, a.version)
}

func (a *App) Convert(dir string) (err error) {
	// 予期しないパニックをエラーに変換してアプリのクラッシュを防ぐ
	defer func() {
		if r := recover(); r != nil {
			log.PrintStackTrace(fmt.Errorf("panic in Convert: %v", r))
			err = fmt.Errorf("unexpected error during migration: %v", r)
		}
	}()
	return setup.Convert(dir, a.version)
}
