package api

import (
	"fmt"

	"binder/fs"
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

	// 移行はバインダーへ書き込むため、その間は「開いている」印を立てる（fs/openmark.go）
	if err := fs.AcquireOpen(dir); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	defer fs.ReleaseOpen(dir)

	return setup.Convert(dir, a.version)
}
