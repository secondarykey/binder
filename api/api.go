package api

import (
	"binder"
	"binder/settings"
	"log"
	"log/slog"

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

	err := binder.Install(dir, name, sample)
	if err != nil {
		rtn := fmt.Errorf("binder Install error\n%+v", err)
		slog.Error(err.Error())
		return rtn
	}

	err = a.load(dir)
	if err != nil {
		rtn := fmt.Errorf("binder load error\n%+v", err)
		slog.Error(err.Error())
		return rtn
	}

	err = a.current.Initialize()
	if err != nil {
		rtn := fmt.Errorf("binder Initialize() error\n%+v", err)
		slog.Error(err.Error())
		return rtn
	}

	return nil
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

func (a *App) CreateRemoteBinder(url string, dir string) error {

	err := binder.CreateRemote(url, dir)
	if err != nil {
		return fmt.Errorf("CreateRemote() error\n%+v", err)
	}

	err = a.load(dir)
	if err != nil {
		return fmt.Errorf("load() error\n%+v", err)
	}

	return nil
}

func (a *App) LoadBinder(dir string) error {

	err := a.load(dir)
	if err != nil {
		return fmt.Errorf("load() error\n%+v", err)
	}
	return nil
}

func (a *App) load(dir string) error {

	if dir == "" {
		return xerrors.Errorf("empty directory error")
	}

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
	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}
	return fmt.Sprintf("http://%s", a.current.ServerAddress()), nil
}

func (a *App) GetTree() (*binder.Tree, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	r, err := a.current.GetTree()
	if err != nil {
		return nil, fmt.Errorf("GetTree() error\n%+v", err)
	}
	return r, nil
}

func (a *App) Remotes() ([]string, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	remotes, err := a.current.GetRemotes()
	if err != nil {
		return nil, fmt.Errorf("GetRemotes() error: %+v", err)
	}
	return remotes, nil
}

func (a *App) AddRemote(name string, url string) error {

	if a.current == nil {
		return fmt.Errorf("Not Open Binder")
	}

	err := a.current.CreateRemote(name, url)
	if err != nil {
		return fmt.Errorf("CreateRemote() error: %+v", err)
	}
	return nil
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
	address, _ := a.Address()
	runtime.BrowserOpenURL(a.ctx, address)
	return nil
}

func (a *App) SaveSetting(s *settings.Setting) error {
	return a.current.SaveSetting(s)
}

func (a *App) GetSetting() *settings.Setting {
	return settings.Get()
}
