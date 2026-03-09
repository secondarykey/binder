package main

import (
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

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
	app            *application.App
	window         *application.WebviewWindow
	commitWindow   *application.WebviewWindow
	historyWindows map[string]*application.WebviewWindow // key: typ+":"+id
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

func (r *wailsRuntime) OpenHistoryWindow(typ, id string) error {
	key := typ + ":" + id

	if r.historyWindows == nil {
		r.historyWindows = make(map[string]*application.WebviewWindow)
	}

	// 既に開いていれば前面に出すだけ
	if w, ok := r.historyWindows[key]; ok {
		w.Focus()
		return nil
	}

	w := r.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Binder - History",
		Width:            900,
		Height:           600,
		MinWidth:         600,
		MinHeight:        400,
		Frameless:        true,
		BackgroundColour: application.NewRGBA(27, 38, 54, 255),
		URL:              "/?history=1&type=" + typ + "&id=" + id,
	})

	r.historyWindows[key] = w

	// ウィンドウが閉じられたらリセット
	w.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		delete(r.historyWindows, key)
	})

	return nil
}

func (r *wailsRuntime) OpenModifiedWindow() error {
	// 既に開いていれば前面に出すだけ
	if r.commitWindow != nil {
		r.commitWindow.Focus()
		return nil
	}

	w := r.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Binder - Commit",
		Width:            900,
		Height:           600,
		MinWidth:         600,
		MinHeight:        400,
		Frameless:        true,
		BackgroundColour: application.NewRGBA(27, 38, 54, 255),
		URL:              "/?commit=1",
	})

	r.commitWindow = w

	// ウィンドウが閉じられたらリセット
	w.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		r.commitWindow = nil
	})

	return nil
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
		EnableFileDrop:         true,
	})

	// 3. Wails ランタイムを注入して起動処理を実行
	// （Wails v3 の ServiceStartup は使用せず、直接 main() で初期化する）
	rt := &wailsRuntime{app: wailsApp, window: window}
	app.SetRuntime(rt)
	if err := app.Startup(); err != nil {
		log.PrintStackTrace(err)
	}

	// 外部ファイルドロップ: OS からのファイルドロップを Wails ネイティブイベントで処理する。
	// EnableFileDrop: true が前提。Wails runtime (window.ts) が drop を補足し、
	// Go 側の WindowFilesDropped イベントとして通知する。
	window.OnWindowEvent(events.Common.WindowFilesDropped, func(event *application.WindowEvent) {
		ctx := event.Context()
		files := ctx.DroppedFiles()
		details := ctx.DropTargetDetails()

		if len(files) == 0 || details == nil {
			return
		}

		nodeId, hasId := details.Attributes["data-wails-node-id"]
		nodeType := details.Attributes["data-wails-node-type"]

		if !hasId || nodeId == "" {
			return
		}

		if nodeType != "note" {
			wailsApp.Event.Emit("binder:error", "アセットはノートにのみ追加できます")
			return
		}

		if err := app.ImportLocalFiles(nodeId, files); err != nil {
			log.PrintStackTrace(err)
			wailsApp.Event.Emit("binder:error", err.Error())
			return
		}

		wailsApp.Event.Emit("binder:filedrop:done")
	})

	// 4. 実行
	err := wailsApp.Run()
	if err != nil {
		println("Error:", err.Error())
	}
}
