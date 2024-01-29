package api

import (
	"binder"
	"binder/settings"
	"log"

	"context"
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/xerrors"
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

func (a *App) CloseBinder() error {

	if a.current != nil {
		err := a.current.Close()
		a.current = nil

		if err != nil {
			return fmt.Errorf("binder Close() error\n%+v", err)
		}
	}
	return nil
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

func (a *App) CreateBinder(dir string, name string, sample bool) error {

	s := settings.Get()
	//TODO 画面できてからだよ
	todoDir, err := runtime.OpenDirectoryDialog(a.ctx,
		runtime.OpenDialogOptions{
			DefaultDirectory:     s.Path.Default,
			CanCreateDirectories: true,
			Title:                "Select Binder Directory",
		})
	if err != nil {
		return fmt.Errorf("SelectDiretory() error\n%+v", err)
	}
	if todoDir == "" {
		return nil
	}

	dir = todoDir

	err = binder.Install(dir, name, sample)
	if err != nil {
		return fmt.Errorf("binder Install error\n%+v", err)
	}

	err = a.load(dir)
	if err != nil {
		return fmt.Errorf("binder load error\n%+v", err)
	}
	return nil
}

func (a *App) LoadBinder() error {

	s := settings.Get()
	dir, err := runtime.OpenDirectoryDialog(a.ctx,
		runtime.OpenDialogOptions{
			DefaultDirectory: s.Path.Default,
			Title:            "Select Binder Directory",
		})
	if err != nil {
		return fmt.Errorf("SelectDiretory() error\n%+v", err)
	}

	if dir == "" {
		return fmt.Errorf("Cancel")
	}

	err = a.load(dir)
	if err != nil {
		return fmt.Errorf("load() error\n%+v", err)
	}
	return nil
}

func (a *App) load(dir string) error {

	s := settings.Get()
	b, err := binder.Load(dir)
	if err != nil {
		return xerrors.Errorf("Binder Load() error: %w", err)
	}
	a.SetCurrent(b)

	//履歴に追加
	s.Path.AddHistory(dir)
	err = s.Save()
	if err != nil {
		log.Println(err)
	}
	return nil
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

	//TODO ツリーの制限数を設定から見て検索

	r, err := a.current.CreateResource()
	if err != nil {
		return nil, fmt.Errorf("GetResource() error\n%+v", err)
	}

	return r, nil
}

func (a *App) Generate(noteId string, dataId string, elm string) error {
	return a.current.Generate(noteId, dataId, elm)
}

func (a *App) Commit(noteId string, dataId string, auto bool) error {

	err := a.current.SaveCommit(noteId, dataId, auto)
	if err != nil {
		return fmt.Errorf("Commit() error\n%+v", err)
	}
	return nil
}

func (a *App) OpenBinderSite() error {
	address := fmt.Sprintf("http://%s", a.current.ServerAddress())
	runtime.BrowserOpenURL(a.ctx, address)
	return nil
}

func (a *App) SaveSetting(s *settings.Setting) error {
	return a.current.SaveSetting(s)
}

func (a *App) GetSetting() *settings.Setting {
	return settings.Get()
}
