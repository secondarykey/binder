package main

import (
	"embed"
	"log/slog"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"binder/api"
	"binder/settings"
)

//go:embed all:frontend/dist
var assets embed.FS

func attrFunc(groups []string, a slog.Attr) slog.Attr {
	if a.Key == slog.TimeKey {
		return slog.Any("", a.Value)
	} else if a.Key == "msg" {
		return slog.Any("message", a.Value)
	}
	return a
}

func main() {
	/*
		opts := &slog.HandlerOptions{}
		opts.Level = slog.LevelInfo
		opts.ReplaceAttr = attrFunc
		slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, opts)))
	*/

	//開いているBinderに対するProxy
	//handler := binder.NewBinderHandler()
	//app := api.New(handler)
	app := api.New()
	//config を読み込む
	set := settings.Get()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "Binder",
		Width:  set.Position.Width,
		Height: set.Position.Height,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		Frameless:        true,
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.Startup,
		Bind: []interface{}{
			app,
		},
		Debug: options.Debug{
			OpenInspectorOnStartup: true,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
