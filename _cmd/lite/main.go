package main

import (
	"embed"
	"flag"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"binder/lite"
	"binder/log"
	"binder/settings"
	"binder/setup"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed version
var ver string

var debug bool

func init() {
	flag.BoolVar(&debug, "debug", false, "Launch DevTools")
}

func main() {

	flag.Parse()
	logger, err := log.Init()
	if err != nil {
		log.Warn("ログファイルの初期化に失敗:\n%+v", err)
	}
	defer log.Close()

	// ~/.binder/ ディレクトリとデフォルトリソースを配置
	if err := settings.EnsureDir(); err != nil {
		log.Warn("EnsureDir() error:\n%+v", err)
	}
	if err := setup.UpdateDefaults(); err != nil {
		log.Warn("UpdateDefaults() error:\n%+v", err)
	}

	version := strings.TrimSpace(ver)
	app := lite.New(version)
	win := NewWindow(app)

	wailsApp := application.New(application.Options{
		Name:   "Binder Lite",
		Logger: logger,
		Services: []application.Service{
			application.NewService(app),
			application.NewService(win),
		},
		Assets: application.AssetOptions{
			Handler: application.BundledAssetFileServer(assets),
		},
	})

	set := settings.Get()

	window := wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:                  "Binder Lite",
		X:                      set.Position.Left,
		Y:                      set.Position.Top,
		Width:                  set.Position.Width,
		Height:                 set.Position.Height,
		MinWidth:               640,
		MinHeight:              400,
		Frameless:              true,
		BackgroundColour:       application.NewRGBA(27, 38, 54, 255),
		URL:                    "/",
		OpenInspectorOnStartup: debug,
		EnableFileDrop:         true,
	})

	// 位置がおかしい場合は中央に設定
	if set.Position.Left < 0 && set.Position.Top < 0 {
		window.Center()
	}

	win.runtime = wailsApp
	win.window = window

	// ファイルドロップ: ドロップされたファイルをフロントエンドに通知
	window.OnWindowEvent(events.Common.WindowFilesDropped, func(event *application.WindowEvent) {
		ctx := event.Context()
		files := ctx.DroppedFiles()
		if len(files) == 0 {
			return
		}
		for _, file := range files {
			wailsApp.Event.Emit("lite:file:dropped", file)
		}
	})

	err = wailsApp.Run()
	if err != nil {
		log.Warn("Run() error:\n%+v", err)
	}
}
