package main

import (
	"binder/api"
	"binder/log"
	"binder/settings"
	"fmt"
	"net/url"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

type Window struct {
	app *api.App

	runtime        *application.App
	window         *application.WebviewWindow
	commitWindow   *application.WebviewWindow
	historyWindows map[string]*application.WebviewWindow // key: typ+":"+id
}

func NewWindow(app *api.App) *Window {
	var win Window
	win.app = app
	return &win
}

func (win *Window) OpenURL(url string) {
	win.runtime.Browser.OpenURL(url)
}

func (r *Window) OpenFileDialog(create bool, defaultDir string) (string, error) {

	dialog := r.runtime.Dialog.OpenFile().
		CanChooseDirectories(true).
		CanChooseFiles(false).
		CanCreateDirectories(create).
		SetTitle("Select Binder Directory")
	if defaultDir != "" {
		dialog.SetDirectory(defaultDir)
	}

	result, err := dialog.PromptForSingleSelection()
	if err != nil {
		return "", fmt.Errorf("OpenFileDialog() error\n%+v", err)
	}
	return result, nil
}

func (r *Window) OpenFilePicker(name, ptn string) (string, error) {
	result, err := r.runtime.Dialog.OpenFile().
		SetTitle("Select File").
		AddFilter(name, ptn).
		PromptForSingleSelection()
	if err != nil {
		return "", fmt.Errorf("OpenFilePicker() error\n%+w", err)
	}
	return result, nil
}

func (win *Window) WindowSize() (int, int) {
	return win.window.Size()
}

func (r *Window) WindowPosition() (int, int) {
	return r.window.Position()
}

func (r *Window) OpenHistoryWindow(typ, id, name string) error {
	key := typ + ":" + id

	if r.historyWindows == nil {
		r.historyWindows = make(map[string]*application.WebviewWindow)
	}

	// 既に開いていれば前面に出すだけ
	if w, ok := r.historyWindows[key]; ok {
		w.Focus()
		return nil
	}

	w := r.runtime.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Binder - History",
		Width:            900,
		Height:           600,
		MinWidth:         600,
		MinHeight:        400,
		Frameless:        true,
		BackgroundColour: application.NewRGBA(27, 38, 54, 255),
		URL:              "/?history=1&type=" + typ + "&id=" + id + "&name=" + url.QueryEscape(name),
	})

	r.historyWindows[key] = w

	// ウィンドウが閉じられたらリセット
	w.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		delete(r.historyWindows, key)
	})

	return nil
}

// setting.go
func (win *Window) SavePosition() error {

	w, h := win.window.Size()
	x, y := win.window.Position()

	var pos settings.Position

	pos.Left = x
	pos.Top = y
	pos.Width = w
	pos.Height = h

	err := win.app.SavePosition(&pos)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("SaveSetting() error:\n%+v", err)
	}

	return nil
}

func (win *Window) SelectDirectory(create bool) (string, error) {
	defer log.PrintTrace(log.Func("SelectDirectory()"))

	s := settings.Get()
	dir, err := win.OpenFileDialog(create, s.Path.Default)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("SelectDirectory() error\n%+v", err)
	}
	return dir, nil
}

func (win *Window) SelectFile(name string, ptn string) (string, error) {
	defer log.PrintTrace(log.Func("SelectFile()"))

	selection, err := win.OpenFilePicker(name, ptn)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("SelectFile() error\n%+v", err)
	}
	return selection, nil
}

func (win *Window) OpenBinderSite() error {
	defer log.PrintTrace(log.Func("OpenBinderSite()"))

	address, _ := win.app.Address()
	win.runtime.Browser.OpenURL(address)

	return nil
}

func (win *Window) Terminate() bool {

	//TODO ログに出力
	err := win.SavePosition()
	if err != nil {
	}

	err = win.app.CloseBinder()
	if err != nil {
	}

	win.runtime.Quit()
	return false
}
