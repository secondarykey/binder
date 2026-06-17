package main

import (
	"embed"
	"flag"
	"log/slog"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"binder"
	"binder/api"
	"binder/api/shared"
	"binder/log"
	"binder/settings"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed version
var ver string

var resetPosition bool
var safe bool
var debug bool

// wailsSearchEmitter は api.SearchEmitter を Wails イベントで実装する
type wailsSearchEmitter struct {
	app *application.App
}

func (e *wailsSearchEmitter) EmitResult(result binder.SearchResult) {
	e.app.Event.Emit("binder:search:result", result)
}

func (e *wailsSearchEmitter) EmitDone() {
	e.app.Event.Emit("binder:search:done")
}

func init() {
	flag.BoolVar(&resetPosition, "reset-position", false, "Windows Position reset")
	flag.BoolVar(&safe, "safe", false, "Prevent files from opening automatically.")
	flag.BoolVar(&debug, "debug", false, "Launch DevTools")
}

func main() {

	flag.Parse()
	logger, err := log.Init()
	if err != nil {
		log.Warn("ログファイルの初期化に失敗:\n%+v", err)
	}
	defer log.Close()
	if debug {
		log.SetLevel(slog.LevelDebug)
	}

	app := api.New(strings.TrimSpace(ver))
	win := NewWindow(app)

	// 1. アプリケーション作成
	// wails3 に依存するサービスはWindowに設定する
	wailsApp := application.New(application.Options{
		Name:   "Binder",
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

	// 開発モード判定（Wails v3 が production ビルドタグで内部管理）
	dev := wailsApp.Env.Info().Debug
	app.SetDevMode(dev)
	if dev {
		log.SetLevel(slog.LevelInfo)
	}

	// 2. セットアップ（devMode 判定後に実行し、アプリバージョンアップ処理を含む）
	set, err := app.Setup()
	if err != nil {
		log.PrintStackTrace(err)
	}

	// i18n 初期化（ウィンドウ作成前に実行）
	if err := settings.InitI18n(set.Language); err != nil {
		log.Warn("settings.InitI18n() error:\n%+v", err)
	}

	// セーフモードまたは前回クラッシュ検出時は、今セッションの自動オープンをオフにする。
	// RunWithOpen 自体は setting.json に保存しない（次回以降の設定は保持する）。
	if safe || !set.Path.StartupOk {
		set.Path.RunWithOpen = false
	}

	// 起動中フラグを false に設定して保存（正常終了しなかった場合のクラッシュ検出用）。
	// アプリが正常終了したときに true に書き戻す。
	if err := settings.SaveStartupOk(false); err != nil {
		log.Warn("SaveStartupOk(false) error:\n%+v", err)
	}

	// 3. ウィンドウ作成
	// InitialPosition のデフォルトは WindowCentered(0) なので、
	// 保存位置を使う場合は WindowXY を明示的に指定する必要がある。
	initialPos := application.WindowCentered
	if !set.IsDefault() && !resetPosition {
		initialPos = application.WindowXY
	}

	window := wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:                  settings.T("go.window.main"),
		InitialPosition:        initialPos,
		X:                      set.Position.Left,
		Y:                      set.Position.Top,
		Width:                  set.Position.Width,
		Height:                 set.Position.Height,
		MinWidth:               480,
		MinHeight:              320,
		Frameless:              true,
		BackgroundColour:       application.NewRGBA(27, 38, 54, 255),
		URL:                    "/",
		OpenInspectorOnStartup: debug,
		EnableFileDrop:         true,
	})

	// 保存位置が画面外の場合（モニター変更等）は中央配置にフォールバック
	if initialPos == application.WindowXY {
		window.OnWindowEvent(events.Common.WindowRuntimeReady, func(event *application.WindowEvent) {
			if !isPositionOnScreen(wailsApp, set.Position.Left, set.Position.Top) {
				log.Debug("saved position left=%d top=%d is off-screen, centering",
					set.Position.Left, set.Position.Top)
				window.Center()
			}
		})
	}

	// 4. Wails ランタイムを注入して起動処理を実行
	win.runtime = wailsApp
	win.window = window

	// 検索イベントエミッターを設定
	app.SearchEmitter = &wailsSearchEmitter{app: wailsApp}
	// バインダー切り替え時にウィンドウを閉じる
	app.WindowCloser = win

	// 言語変更時にウィンドウタイトルを更新
	settings.OnLanguageChange(func(code string) {
		window.SetTitle(settings.T("go.window.main"))
		win.UpdateWindowTitles()
	})

	// ウィンドウフォーカス取得時にフロントエンドへ通知（IME コンテキストリセット用）
	// events.Common.WindowFocus は Windows 実装では emit されない（WM_SETFOCUS は
	// events.Windows.WindowSetFocus を emit する）ため、正しいイベントを使う。
	window.OnWindowEvent(events.Windows.WindowSetFocus, func(event *application.WindowEvent) {
		wailsApp.Event.Emit("binder:window:focus")
	})

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
			wailsApp.Event.Emit("binder:error", settings.T("go.error.assetsNoteOnly"))
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
		log.Warn("Run() error:\n%+v", err)
	}

	// wailsApp.Run() が正常リターンした = 正常終了。
	// 次回起動で自動オープンが動くよう StartupOk を true に戻す。
	if err := settings.SaveStartupOk(true); err != nil {
		log.Warn("SaveStartupOk(true) error:\n%+v", err)
	}
}

// isPositionOnScreen は指定座標がいずれかの画面の作業領域内にあるかを判定する。
// ウィンドウの左上隅がどの画面にも含まれない場合は false を返す。
func isPositionOnScreen(app *application.App, x, y int) bool {
	screens := app.Screen.GetAll()
	if len(screens) == 0 {
		return true
	}
	for _, s := range screens {
		wa := s.WorkArea
		if x >= wa.X && x < wa.X+wa.Width && y >= wa.Y && y < wa.Y+wa.Height {
			return true
		}
	}
	return false
}
