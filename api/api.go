package api

import (
	"binder"
	"binder/settings"
	"log"

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
	app.current = c
	//app.handler.SetFS(c, fs.PublishDir)
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	set := settings.Get()
	if set.Path.RunWithOpen {
		his := set.Path.Histories
		if len(his) > 0 {
			b, err := binder.Load(his[0])
			if err != nil {
				log.Printf("Binder Load() error: %+v", err)
			} else {
				a.SetCurrent(b)
			}
		}
	}
}

func (a *App) Terminate() bool {
	if a.current != nil {
		err := a.current.Close()
		if err != nil {
			log.Printf("binder Close() error: %+v", err)
			os.Exit(1)
		}
	}
	os.Exit(0)
	return false
}

func (a *App) SelectDirectory(create bool) (string, error) {

	s := settings.Get()

	dir, err := runtime.OpenDirectoryDialog(a.ctx,
		runtime.OpenDialogOptions{
			DefaultDirectory:     s.Path.Default,
			CanCreateDirectories: create,
			Title:                "Select Binder Directory",
		})

	if err != nil {
		return "", fmt.Errorf("SelectDiretory() error\n%+v", err)
	}
	return dir, nil
}

func (a *App) SelectFile(name string, ptn string) (string, error) {

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
		return "", fmt.Errorf("SelectFile() error\n%+v", err)
	}
	return selection, nil
}

func (a *App) Generate(noteId string, dataId string, elm string) error {
	return a.current.Generate(noteId, dataId, elm)
}

func (a *App) OpenBinderSite() error {
	address, _ := a.Address()
	runtime.BrowserOpenURL(a.ctx, address)
	return nil
}

func (a *App) Address() (string, error) {
	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}
	return fmt.Sprintf("http://%s", a.current.ServerAddress()), nil
}
