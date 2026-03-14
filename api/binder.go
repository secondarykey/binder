package api

import (
	"binder"
	"binder/log"
	"binder/settings"
	"fmt"
	"log/slog"

	"golang.org/x/xerrors"
)

func (a *App) LoadBinder(dir string) (string, error) {

	defer log.PrintTrace(log.Func("LoadBinder()"))

	add, err := a.load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("load() error\n%+v", err)
	}

	return add, nil
}

func (a *App) load(dir string) (string, error) {

	if dir == "" {
		return "", xerrors.Errorf("empty directory error")
	}

	s := settings.Get()
	b, err := binder.Load(dir, a.version)
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

	//履歴に追加
	s.Path.AddHistory(dir)
	err = s.Save()
	if err != nil {
		log.PrintStackTrace(err)
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

	err := binder.Install(dir, a.version)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("binder Install error\n%+v", err)
	}

	address, err := a.load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("binder load error\n%+v", err)
	}

	err = a.current.Initialize(name)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("binder Initialize() error\n%+v", err)
	}

	return address, nil
}

func (a *App) CreateRemoteBinder(url string, dir string) (string, error) {

	defer log.PrintTrace(log.Func("CreateRemoteBinder()"))

	err := binder.CreateRemote(url, dir, a.version)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("CreateRemote() error\n%+v", err)
	}

	address, err := a.load(dir)
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

func (a *App) RunEditor(mode, id string) error {

	defer log.PrintTrace(log.Func("RunEditor()", mode, id))

	err := a.current.RunEditor(mode, id)
	if err != nil {
		return xerrors.Errorf("RunEditor() error: %+v", err)
	}
	return nil
}
