package main

import (
	"embed"
	"encoding/json"
	"flag"
	"log/slog"

	"github.com/wailsapp/wails/v3/pkg/application"

	"binder/api"
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
		Title:            "Binder",
		Width:            set.Position.Width,
		Height:           set.Position.Height,
		Frameless:        true,
		BackgroundColour:       application.NewRGBA(27, 38, 54, 255),
		URL:                   "/",
		OpenInspectorOnStartup: true,
	})

	app.SetWindow(window)

	// 3. 実行
	err := wailsApp.Run()
	if err != nil {
		println("Error:", err.Error())
	}
}
