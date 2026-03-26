package main

import (
	"embed"
	"flag"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"binder/api"
	"binder/log"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed version
var ver string

var resetPosition bool

func init() {
	flag.BoolVar(&resetPosition, "reset-position", false, "Windows Position reset")
}

func main() {

	flag.Parse()

	if err := log.Init(); err != nil {
		log.WarnE("ログファイルの初期化に失敗", err)
	}
	defer log.Close()

	app := api.New(strings.TrimSpace(ver))
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

	// 開発モード判定（Wails v3 が production ビルドタグで内部管理）
	app.SetDevMode(wailsApp.Env.Info().Debug)

	// 2. セットアップ（devMode 判定後に実行し、アプリバージョンアップ処理を含む）
	set, err := app.Setup()
	if err != nil {
		log.PrintStackTrace(err)
	}

	// 3. ウィンドウ作成
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

	// 4. Wails ランタイムを注入して起動処理を実行
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

	// 5. 実行
	err = wailsApp.Run()
	if err != nil {
		println("Error:", err.Error())
	}
}
