package api

import (
	. "binder/internal"
	"log/slog"

	"binder"
	"binder/log"
	"binder/settings"

	"context"
	"fmt"
	"os"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// App struct
type App struct {
	app     *application.App
	window  *application.WebviewWindow
	current *binder.Binder

	version *Version
}

func New(version string) *App {

	var app App
	var err error
	app.version, err = NewVersion(version)
	if err != nil {
		slog.Warn(fmt.Sprintf("Version parse error: %+v", err))
	}

	log.Notice(fmt.Sprintf("Binder Version: %s", app.version))

	return &app
}

func (a *App) SetWindow(w *application.WebviewWindow) {
	a.window = w
}

func (app *App) SetCurrent(c *binder.Binder) {
	defer log.PrintTrace(log.Func("SetCurrent()"))
	app.current = c
}

// ServiceStartup is called by Wails v3 during application startup
func (a *App) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {

	defer log.PrintTrace(log.Func("ServiceStartup()"))

	a.app = application.Get()

	set := settings.Get()
	if set.Path.RunWithOpen {
		his := set.Path.Histories
		if len(his) > 0 {
			b, err := binder.Load(his[0], a.version)
			if err != nil {
				log.PrintStackTrace(err)
			} else {
				a.SetCurrent(b)
				err = b.Serve()
				if err != nil {
					log.PrintStackTrace(err)
				}
			}
		}
	}

	return nil
}

func (a *App) Terminate() bool {

	defer log.PrintTrace(log.Func("Terminate()"))

	if a.current != nil {
		err := a.current.Close()
		if err != nil {
			log.PrintStackTrace(err)
			os.Exit(1)
		}
	}
	a.app.Quit()
	return false
}

func (a *App) SelectDirectory(create bool) (string, error) {

	defer log.PrintTrace(log.Func("SelectDirectory()"))

	s := settings.Get()
	dialog := a.app.Dialog.OpenFile().
		CanChooseDirectories(true).
		CanChooseFiles(false).
		CanCreateDirectories(create).
		SetTitle("Select Binder Directory")

	if s.Path.Default != "" {
		dialog.SetDirectory(s.Path.Default)
	}

	dir, err := dialog.PromptForSingleSelection()
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("SelectDirectory() error\n%+v", err)
	}
	return dir, nil
}

func (a *App) SelectFile(name string, ptn string) (string, error) {

	defer log.PrintTrace(log.Func("SelectFile()"))

	selection, err := a.app.Dialog.OpenFile().
		SetTitle("Select File").
		AddFilter(name, ptn).
		PromptForSingleSelection()

	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("SelectFile() error\n%+v", err)
	}
	return selection, nil
}

func (a *App) OpenBinderSite() error {

	defer log.PrintTrace(log.Func("OpenBinderSite()"))

	address, _ := a.Address()
	a.app.Browser.OpenURL(address)

	return nil
}

func (a *App) Address() (string, error) {

	defer log.PrintTrace(log.Func("Address()"))

	return fmt.Sprintf("http://%s", a.current.ServerAddress()), nil
}

type KVList []*KeyValue

func newKVList(cp int) KVList {
	rtn := make([]*KeyValue, 0, cp)
	return rtn
}

func (l KVList) Add(k, v string) KVList {
	l = append(l, newKV(k, v))
	return l
}

type KeyValue struct {
	Key   string
	Value string
}

func newKV(k, v string) *KeyValue {
	var kv KeyValue
	kv.Key = k
	kv.Value = v
	return &kv
}
