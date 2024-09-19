package api

import (
	"binder"
	"binder/log"
	"binder/settings"

	"context"
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx     context.Context
	current *binder.Binder
	//handler *binder.BinderHandler
}

// NewApp creates a new App application struct
// func New(h *binder.BinderHandler) *App {
func New() *App {
	var app App
	//app.handler = h
	return &app
}

func (app *App) SetCurrent(c *binder.Binder) {
	defer log.PrintTrace(log.Func("SetCurrent()"))
	app.current = c
	//app.handler.SetFS(c, fs.PublishDir)
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {

	defer log.PrintTrace(log.Func("Startup()"))

	a.ctx = ctx
	set := settings.Get()
	if set.Path.RunWithOpen {
		his := set.Path.Histories
		if len(his) > 0 {
			b, err := binder.Load(his[0])
			if err != nil {
				log.PrintStackTrace(err)
			} else {
				a.SetCurrent(b)
			}
		}
	}
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
	os.Exit(0)
	return false
}

func (a *App) SelectDirectory(create bool) (string, error) {

	defer log.PrintTrace(log.Func("SelectDirectory()"))

	s := settings.Get()
	dir, err := runtime.OpenDirectoryDialog(a.ctx,
		runtime.OpenDialogOptions{
			DefaultDirectory:     s.Path.Default,
			CanCreateDirectories: create,
			Title:                "Select Binder Directory",
		})

	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("SelectDiretory() error\n%+v", err)
	}
	return dir, nil
}

func (a *App) SelectFile(name string, ptn string) (string, error) {

	defer log.PrintTrace(log.Func("SelectFile()"))

	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select File",
		Filters: []runtime.FileFilter{
			{
				DisplayName: name,
				Pattern:     ptn,
			},
		},
	})
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("SelectFile() error\n%+v", err)
	}
	return selection, nil
}

func (a *App) Generate(noteId string, dataId string, elm string) error {

	defer log.PrintTrace(log.Func("Generate()"))

	err := a.current.Generate(noteId, dataId, elm)
	if err != nil {
		log.PrintStackTrace(err)
		return err
	}
	return nil
}

func (a *App) OpenBinderSite() error {

	defer log.PrintTrace(log.Func("OpenBinderSite()"))

	address, _ := a.Address()
	runtime.BrowserOpenURL(a.ctx, address)

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
