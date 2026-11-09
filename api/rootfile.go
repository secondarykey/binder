package api

import (
	"binder/fs"
	"binder/log"
	"binder/settings"
	"binder/setup"
	"fmt"
)

// ListRootFiles はバインダールート直下のユーザーファイル一覧を返す。
func (a *App) ListRootFiles() ([]fs.RootFileInfo, error) {
	defer log.PrintTrace(log.Func("ListRootFiles()"))
	if a.current == nil {
		return []fs.RootFileInfo{}, nil
	}
	return a.current.ListRootFiles()
}

// ReadRootFile はルートファイルの内容を返す。
func (a *App) ReadRootFile(name string) (string, error) {
	defer log.PrintTrace(log.Func("ReadRootFile()", name))
	if a.current == nil {
		return "", fmt.Errorf("%s", settings.T("go.error.noBinderOpen"))
	}
	content, err := a.current.ReadRootFile(name)
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}
	return content, nil
}

// SaveRootFile はルートファイルを保存する（コミットは行わない）。
func (a *App) SaveRootFile(name, content string) error {
	defer log.PrintTrace(log.Func("SaveRootFile()", name))
	if a.current == nil {
		return fmt.Errorf("%s", settings.T("go.error.noBinderOpen"))
	}
	if err := a.current.SaveRootFile(name, content); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

// RemoveRootFile はルートファイルを削除する（コミットは行わない）。
func (a *App) RemoveRootFile(name string) error {
	defer log.PrintTrace(log.Func("RemoveRootFile()", name))
	if a.current == nil {
		return fmt.Errorf("%s", settings.T("go.error.noBinderOpen"))
	}
	if err := a.current.RemoveRootFile(name); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

// RenameRootFile はルートファイルをリネームする（コミットは行わない）。
func (a *App) RenameRootFile(oldName, newName string) error {
	defer log.PrintTrace(log.Func("RenameRootFile()", oldName, newName))
	if a.current == nil {
		return fmt.Errorf("%s", settings.T("go.error.noBinderOpen"))
	}
	if err := a.current.RenameRootFile(oldName, newName); err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

// ListRootFileTemplates はルートファイルの雛形（AGENTS.md 等）の名前の一覧を返す。
// 雛形はバインダーへ自動では置かず、ユーザが選んだときだけ書き出す。
func (a *App) ListRootFileTemplates() ([]string, error) {
	defer log.PrintTrace(log.Func("ListRootFileTemplates()"))
	names, err := setup.RootFileTemplates()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return names, nil
}

// ReadRootFileTemplate は雛形の中身を、いまのアプリの言語で返す（無い言語は英語）。
func (a *App) ReadRootFileTemplate(name string) (string, error) {
	defer log.PrintTrace(log.Func("ReadRootFileTemplate()", name))
	content, err := setup.RootFileTemplate(name, settings.I18nLang())
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}
	return content, nil
}
