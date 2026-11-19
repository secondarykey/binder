package api

import (
	"fmt"

	"binder/fs"
	"binder/log"
	"binder/settings"
	"binder/setup"

	"golang.org/x/xerrors"
)

// Setup はアプリレベルの準備（~/.binder の作成・移行など）を行い、設定を返す。
// 準備に失敗してもエラーと一緒に設定を返す（settings.Get() は読めなければ既定値を返す）。
// main() はエラーをログに残して起動を続けるため、nil を返すとそこで落ちる。
func (a *App) Setup() (*settings.Setting, error) {

	err := setup.EnsureExists(a.version, a.devMode)
	set := settings.Get()
	if err != nil {
		return set, xerrors.Errorf("setup.EnsureExists() error: %w", err)
	}
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

	// 読み取り専用で開いているバインダーは移行しない（この App は「開いている」印を持っていないので、
	// 下の AcquireOpen が通ってしまうことがある）
	if a.current.ReadOnly() && a.current.Dir() == dir {
		return userError(fs.ErrReadOnly)
	}

	// 移行はバインダーへ書き込むため、その間は「開いている」印を立てる（fs/openmark.go）
	if err := fs.AcquireOpen(dir); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	defer fs.ReleaseOpen(dir)

	return setup.Convert(dir, a.version)
}
