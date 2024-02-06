package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"binder/api"
	"binder/settings"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {

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
