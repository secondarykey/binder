package main

import (
	"binder/lite"
	"binder/log"
	"binder/settings"
	"fmt"
	"os"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Window は Wails v3 の第2 Service。ウィンドウ操作とファイルダイアログを担当する。
type Window struct {
	app *lite.App

	runtime *application.App
	window  *application.WebviewWindow
}

func NewWindow(app *lite.App) *Window {
	return &Window{app: app}
}

// OpenFileDialog はファイル選択ダイアログを表示し、選択された .md ファイルのパスを返す。
func (w *Window) OpenFileDialog() (string, error) {
	defer log.PrintTrace(log.Func("OpenFileDialog()"))

	result, err := w.runtime.Dialog.OpenFile().
		SetTitle("Open File").
		AddFilter("Markdown Files", "*.md;*.markdown;*.txt").
		AddFilter("Mermaid Files", "*.mmd;*.mermaid").
		AddFilter("All Files", "*.*").
		PromptForSingleSelection()
	if err != nil {
		if result == "" {
			return "", nil
		}
		return "", fmt.Errorf("OpenFileDialog() error\n%+v", err)
	}
	return result, nil
}

// SaveFileDialog は保存先ファイル選択ダイアログを表示する（名前を付けて保存）。
func (w *Window) SaveFileDialog(defaultName string) (string, error) {
	defer log.PrintTrace(log.Func("SaveFileDialog()"))

	dialog := w.runtime.Dialog.SaveFile().
		SetMessage("Save As").
		AddFilter("Markdown Files", "*.md;*.markdown").
		AddFilter("All Files", "*.*")

	if defaultName != "" {
		dialog.SetFilename(defaultName)
	}

	result, err := dialog.PromptForSingleSelection()
	if err != nil {
		if result == "" {
			return "", nil
		}
		return "", fmt.Errorf("SaveFileDialog() error\n%+v", err)
	}
	return result, nil
}

// NewFile は新規ファイルの保存先を選択し、空ファイルを作成してパスを返す。
func (w *Window) NewFile() (string, error) {
	defer log.PrintTrace(log.Func("NewFile()"))

	path, err := w.SaveFileDialog("untitled.md")
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}

	// 空ファイルを作成
	if err := os.WriteFile(path, []byte(""), 0644); err != nil {
		return "", fmt.Errorf("WriteFile() error\n%+v", err)
	}
	return path, nil
}

// SavePosition はウィンドウの位置・サイズを保存する。
func (w *Window) SavePosition() error {
	defer log.PrintTrace(log.Func("SavePosition()"))

	width, height := w.window.Size()
	x, y := w.window.Position()

	return settings.SavePosition(&settings.Position{
		Left:   x,
		Top:    y,
		Width:  width,
		Height: height,
	})
}

// Terminate はアプリ終了時に呼ばれる。
func (w *Window) Terminate() bool {
	if err := w.SavePosition(); err != nil {
		log.Warn("SavePosition() error:\n%+v", err)
	}
	w.runtime.Quit()
	return false
}
