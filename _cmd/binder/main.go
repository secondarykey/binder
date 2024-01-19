package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"binder"
	"binder/api"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {

	//config を読み込む
	//前回の読み込みを行う設定の場合、Binderを設定しておく

	// Create an instance of the app structure
	app := api.New()

	//StartUp???
	dir := "D:\\Go\\Projects\\binder\\_cmd\\work"
	b, err := binder.Load(dir)
	if err != nil {
		println("Error:", err.Error())
		return
	}
	app.SetCurrent(b)

	// Create application with options
	err = wails.Run(&options.App{
		Title:  "Binder",
		Width:  1280,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		Frameless:        true,
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.Startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
