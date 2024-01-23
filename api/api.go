package api

import (
	"binder"

	"context"
	"fmt"
	"log"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx     context.Context
	current *binder.Binder
}

// NewApp creates a new App application struct
func New() *App {
	return &App{}
}

func (app *App) SetCurrent(c *binder.Binder) {
	app.current = c
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) Close() bool {

	selection, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "Close",
		Message:       "Exit?",
		DefaultButton: "No",
	})

	if err != nil {
		log.Println(err)
		return false
	}

	if selection == "Yes" {
		//TODO 終了処理を行う
		a.current.Close()
		os.Exit(0)
	}

	return false
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

func (a *App) Address() (string, error) {
	//TODO 起動してない時？
	return a.current.ServerAddress(), nil
}

func (a *App) GetResource() (*binder.Resource, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	r, err := a.current.CreateResource()
	if err != nil {
		return nil, fmt.Errorf("GetResource() error\n%+v", err)
	}

	return r, nil
}

func (a *App) Generate(noteId string, dataId string, elm string) error {
	return a.current.Generate(noteId, dataId, elm)
}
