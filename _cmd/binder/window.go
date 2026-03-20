package main

import (
	"binder/api"
	"binder/fs"
	"binder/log"
	"binder/settings"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"golang.org/x/xerrors"
)

type Window struct {
	app *api.App

	runtime        *application.App
	window         *application.WebviewWindow
	commitWindow   *application.WebviewWindow
	historyWindows map[string]*application.WebviewWindow // key: typ+":"+id
	previewWindow  *application.WebviewWindow
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
		if _, err := os.Stat(defaultDir); err == nil {
			dialog.SetDirectory(defaultDir)
		}
	}

	result, err := dialog.PromptForSingleSelection()
	if err != nil {
		// ダイアログがキャンセルされた場合はエラーではなく空文字を返す
		if result == "" {
			return "", nil
		}
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
		// ダイアログがキャンセルされた場合はエラーではなく空文字を返す
		if result == "" {
			return "", nil
		}
		return "", fmt.Errorf("OpenFilePicker() error\n%+v", err)
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

func (r *Window) OpenPreviewWindow(typ, id, name string) error {
	// 既に開いていれば前面に出すだけ
	if r.previewWindow != nil {
		r.previewWindow.Focus()
		return nil
	}

	w := r.runtime.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Binder - Preview",
		Width:            800,
		Height:           600,
		MinWidth:         400,
		MinHeight:        300,
		Frameless:        true,
		BackgroundColour: application.NewRGBA(27, 38, 54, 255),
		URL:              "/?preview=1&type=" + typ + "&id=" + id + "&name=" + url.QueryEscape(name),
	})

	r.previewWindow = w

	// ウィンドウが閉じられたらリセット
	w.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		r.previewWindow = nil
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

const editorFileMark = "{file}"

func (win *Window) RunEditor(mode, id string) error {
	defer log.PrintTrace(log.Func("RunEditor()", mode, id))

	editor := settings.GetEditor()
	entry := editor.Program
	bash := editor.GitBash && runtime.GOOS == "windows"

	fn := win.app.GetFullPath(mode, id)
	slog.Info(fn)

	ch, err := runEditor(entry, fn, bash)
	if err != nil {
		return xerrors.Errorf("runEditor() error: %w", err)
	}

	err = <-ch
	if err != nil {
		return xerrors.Errorf("editor channel error: %w", err)
	}
	return nil
}

func runEditor(entry, fn string, winBash bool) (chan error, error) {

	if winBash {
		fn = fs.ToGitBash(fn)
	}

	//区切り文字のスライスを作成
	lines := splitDQSpace(entry)

	cmd := ""
	fm := false

	var args []string
	for idx, bk := range lines {
		if idx == 0 {
			cmd = bk
		} else {
			word := bk
			idx := strings.Index(word, editorFileMark)
			if idx != -1 {
				word = strings.ReplaceAll(word, editorFileMark, fn)
				fm = true
			}
			args = append(args, word)
		}
	}

	if !fm {
		return nil, xerrors.Errorf("file mark[%s] error", editorFileMark)
	}

	if len(args) <= 0 {
		return nil, xerrors.Errorf("command arguments error")
	}

	exe := exec.Command(cmd, args...)
	err := exe.Start()
	if err != nil {
		return nil, xerrors.Errorf("command start error: %w", err)
	}

	ch := make(chan error)
	go func(ch chan error) {
		err := exe.Wait()
		ch <- err
	}(ch)

	return ch, nil
}

// splitDQSpace はダブルコーテーション込のスペース区切りを行う
func splitDQSpace(v string) []string {

	// ダブルコーテーションで分割
	parts := strings.Split(v, "\"")
	var result []string

	for i, part := range parts {
		if i%2 == 0 {
			// ダブルコーテーション外の部分をスペースで分割
			words := strings.Fields(part)
			result = append(result, words...)
		} else {
			// ダブルコーテーション内の部分をそのまま追加
			result = append(result, part)
		}
	}

	return result
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
