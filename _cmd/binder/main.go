package main

import (
	"embed"
	"flag"
	"log/slog"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"binder/api"
	"binder/log"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/config.yml
var configYml []byte
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
	ver = parseVersion(configYml)
	flag.BoolVar(&resetPosition, "reset-position", false, "Windows Position reset")
}

// parseVersion は config.yml のバイト列から version: "x.y.z" を取り出す。
func parseVersion(data []byte) string {
	const key = `version: "`
	s := string(data)
	idx := strings.Index(s, key)
	if idx < 0 {
		slog.Warn("version not found in config.yml")
		return "0.0.0"
	}
	s = s[idx+len(key):]
	end := strings.Index(s, `"`)
	if end < 0 {
		return "0.0.0"
	}
	return s[:end]
}

func main() {

	flag.Parse()

	app := api.New(ver)
	set, err := app.Setup()
	if err != nil {
		log.PrintStackTrace(err)
	}

	win := NewWindow(app)

	// 1. アプリケーション作成
	// wails3 に依存するサービスはWindowに設定する
	wailsApp := application.New(application.Options{
		Name: "Binder",
		Services: []application.Service{
			application.NewService(app),
			application.NewService(win),
		},
		Assets: application.AssetOptions{
			Handler: application.BundledAssetFileServer(assets),
		},
	})

	// 2. ウィンドウ作成
	window := wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:                  "Binder",
		X:                      set.Position.Left,
		Y:                      set.Position.Top,
		Width:                  set.Position.Width,
		Height:                 set.Position.Height,
		Frameless:              true,
		BackgroundColour:       application.NewRGBA(27, 38, 54, 255),
		URL:                    "/",
		OpenInspectorOnStartup: false,
		EnableFileDrop:         true,
	})

	//位置がおかしい場合は真ん中に設定
	if (set.Position.Left < 0 && set.Position.Top < 0) ||
		resetPosition {
		window.Center()
	}

	// 3. Wails ランタイムを注入して起動処理を実行
	win.runtime = wailsApp
	win.window = window

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
	err = wailsApp.Run()
	if err != nil {
		println("Error:", err.Error())
	}
}
