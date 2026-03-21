package api

import (
	"binder"
	"binder/api/json"
	"binder/log"
	"binder/settings"
	"binder/setup"
	"fmt"
	"log/slog"

	"golang.org/x/xerrors"
)

func (a *App) LoadBinder(dir string) (string, error) {

	defer log.PrintTrace(log.Func("LoadBinder()"))

	if dir == "" {
		return "", xerrors.Errorf("empty directory error")
	}

	b, err := binder.Load(dir)
	if err != nil {
		return "", xerrors.Errorf("Binder Load() error: %w", err)
	}

	err = b.Serve()
	if err != nil {
		return "", xerrors.Errorf("Binder Serve() error: %w", err)
	}
	a.SetCurrent(b)

	address, err := a.Address()
	if err != nil {
		return "", xerrors.Errorf("Binder Address() error: %w", err)
	}

	// 履歴を保存（最近開いたバインダーを先頭にする）
	if err := settings.SaveHistory(dir); err != nil {
		slog.Warn("SaveHistory error", "err", err)
	}

	return address, nil
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

func (a *App) CreateBinder(dir string, name string) (string, error) {

	defer log.PrintTrace(log.Func("CreateBinder()"))

	err := setup.Install(dir, a.version, name)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("setup.Install error\n%+v", err)
	}

	address, err := a.LoadBinder(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("binder load error\n%+v", err)
	}

	return address, nil
}

func (a *App) CreateRemoteBinder(url, dir, branch, workBranch string, info *json.UserInfo, save bool) (string, error) {

	defer log.PrintTrace(log.Func("CreateRemoteBinder()"))

	err := binder.CreateRemote(url, dir, branch, workBranch, info, save, a.version)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("CreateRemote() error\n%+v", err)
	}

	address, err := a.LoadBinder(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("load() error\n%+v", err)
	}

	return address, nil
}

func (a *App) Generate(mode string, id string, data string) error {

	defer log.PrintTrace(log.Func("Generate()", mode, id))

	var err error
	switch mode {
	case "note":

		html, err := a.CreateNoteHTML(id, data)
		if err == nil {
			_, err = a.current.PublishNote(id, []byte(html))
		}

	case "diagram":
		_, err = a.current.PublishDiagram(id, []byte(data))
	case "assets":
		_, err = a.current.PublishAsset(id)

	default:
		//templateはないはず
		slog.Warn("Unknown Mode:" + mode)
	}

	if err != nil {
		return xerrors.Errorf("Publish() error: %+v", err)
	}
	return nil
}

func (a *App) Unpublish(mode string, id string) error {

	defer log.PrintTrace(log.Func("Unpublish()", mode, id))

	var err error
	switch mode {
	case "note":
		err = a.current.UnpublishNote(id)
	case "diagram":
		err = a.current.UnpublishDiagram(id)
	case "assets":
		err = a.current.UnpublishAsset(id)
	default:
		slog.Warn("Unknown Mode:" + mode)
	}

	if err != nil {
		return xerrors.Errorf("Unpublish() error: %+v", err)
	}
	return nil
}

func (a *App) GetFullPath(mode, id string) string {
	defer log.PrintTrace(log.Func("GetFullPath()", mode, id))
	return a.current.GetFullPath(mode, id)
}
