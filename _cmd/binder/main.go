package main

import (
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"

	"github.com/wailsapp/wails/v3/pkg/application"

	"binder/api"
	"binder/log"
	"binder/settings"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed wails.json
var wailsJson []byte
var ver string

func attrFunc(groups []string, a slog.Attr) slog.Attr {
	if a.Key == slog.TimeKey {
		return slog.Any("", a.Value)
	} else if a.Key == "msg" {
		return slog.Any("message", a.Value)
	}
	return a
}

var resetPosition bool

func init() {
	wails := make(map[string]interface{})

	err := json.Unmarshal(wailsJson, &wails)
	if err != nil {
		slog.Error("wails.json not read")
	}
	obj, ok := wails["version"]

	ver = "0.0.0"
	if ok {
		ver = obj.(string)
	}

	flag.BoolVar(&resetPosition, "reset-position", false, "Windows Position reset")
}

// wailsRuntime は api.AppRuntime の Wails v3 実装。
// Wails v3 の依存はこの構造体および main() 内に閉じており、
// ルートの binder パッケージには持ち込まない。
type wailsRuntime struct {
	app    *application.App
	window *application.WebviewWindow
}

func (r *wailsRuntime) Quit() {
	r.app.Quit()
}

func (r *wailsRuntime) OpenURL(url string) {
	r.app.Browser.OpenURL(url)
}

func (r *wailsRuntime) OpenFileDialog(create bool, defaultDir string) (string, error) {
	dialog := r.app.Dialog.OpenFile().
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

func (r *wailsRuntime) OpenFilePicker(name, ptn string) (string, error) {
	result, err := r.app.Dialog.OpenFile().
		SetTitle("Select File").
		AddFilter(name, ptn).
		PromptForSingleSelection()
	if err != nil {
		return "", fmt.Errorf("OpenFilePicker() error\n%+w", err)
	}
	return result, nil
}

func (r *wailsRuntime) WindowSize() (int, int) {
	return r.window.Size()
}

func (r *wailsRuntime) WindowPosition() (int, int) {
	return r.window.Position()
}

func main() {

	flag.Parse()

	app := api.New(ver)
	set := settings.Get()

	// 1. アプリケーション作成
	wailsApp := application.New(application.Options{
		Name: "Binder",
		Services: []application.Service{
			application.NewService(app),
		},
		Assets: application.AssetOptions{
			Handler: application.BundledAssetFileServer(assets),
		},
	})

	// 2. ウィンドウ作成
	window := wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:                  "Binder",
		Width:                  set.Position.Width,
		Height:                 set.Position.Height,
		Frameless:              true,
		BackgroundColour:       application.NewRGBA(27, 38, 54, 255),
		URL:                    "/",
		OpenInspectorOnStartup: true,
	})

	// 3. Wails ランタイムを注入して起動処理を実行
	// （Wails v3 の ServiceStartup は使用せず、直接 main() で初期化する）
	rt := &wailsRuntime{app: wailsApp, window: window}
	app.SetRuntime(rt)
	if err := app.Startup(); err != nil {
		log.PrintStackTrace(err)
	}

	// 4. 実行
	err := wailsApp.Run()
	if err != nil {
		println("Error:", err.Error())
	}
}
