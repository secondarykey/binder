package main

import (
	"embed"
	"flag"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"binder/api/lite"
	"binder/api/shared"
	"binder/log"
	"binder/settings"
	"binder/setup"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed version
var ver string

var debug bool
var newWindow bool

func init() {
	flag.BoolVar(&debug, "debug", false, "Launch DevTools")
	flag.BoolVar(&newWindow, "new-window", false, "Skip single-instance check")
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

	// 引数にファイルが指定されていれば絶対パスに変換
	var filePaths []string
	if args := flag.Args(); len(args) > 0 {
		filePaths = make([]string, 0, len(args))
		for _, arg := range args {
			absPath, err := filepath.Abs(arg)
			if err == nil {
				filePaths = append(filePaths, absPath)
			} else {
				filePaths = append(filePaths, arg)
			}
		}
	}

	// ファイル指定ありの場合: 既存プロセスがあればそちらで開いて終了
	if !newWindow && len(filePaths) > 0 && trySendToExisting(filePaths) {
		os.Exit(0)
	}

	// パイプサーバー起動: 他プロセスからのファイル受信を待機
	var wailsApp *application.App
	win := new(Window)
	listenForFiles(func(files []string) {
		if wailsApp == nil {
			return
		}
		for _, f := range files {
			wailsApp.Event.Emit("lite:file:dropped", f)
		}
		if win.window != nil {
			win.window.Restore()
			win.window.Focus()
		}
	})

	app := lite.New(version)
	app.SetInitialFiles(filePaths)

	// i18n 初期化（ウィンドウ作成前に実行）
	liteLang := settings.GetLite().Language
	if err := settings.InitI18n(liteLang); err != nil {
		log.Warn("settings.InitI18n() error:\n%+v", err)
	}

	win.app = app

	wailsApp = application.New(application.Options{
		Name:   settings.T("go.window.lite"),
		Logger: logger,
		Services: []application.Service{
			application.NewService(app),
			application.NewService(win),
			application.NewService(shared.New()),
		},
		Assets: application.AssetOptions{
			Handler: application.BundledAssetFileServer(assets),
		},
	})

	set := settings.GetLite()

	window := wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:                  settings.T("go.window.lite"),
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

	// 言語変更時にウィンドウタイトルを更新
	settings.OnLanguageChange(func(code string) {
		window.SetTitle(settings.T("go.window.lite"))
	})

	// ウィンドウフォーカス: IME リセット用イベントをフロントエンドに通知
	// events.Common.WindowFocus は Windows 実装では emit されないため WindowSetFocus を使う
	window.OnWindowEvent(events.Windows.WindowSetFocus, func(event *application.WindowEvent) {
		wailsApp.Event.Emit("lite:window:focus")
	})

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
