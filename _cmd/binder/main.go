package main

import (
	"embed"
	"encoding/json"
	"flag"
	"log/slog"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

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
	flag.BoolVar(&resetPos, "reset-position", false, "Windows Position reset")
}

func main() {

	flag.Parse()
	/*
		opts := &slog.HandlerOptions{}
		opts.Level = slog.LevelInfo
		opts.ReplaceAttr = attrFunc
		slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, opts)))
	*/

	//開いているBinderに対するProxy
	//handler := binder.NewBinderHandler()
	//app := api.New(handler)
	app := api.New(ver)
	//config を読み込む
	set := settings.Get()

	if !set.IsDefault() {
		//起動引数候補を作成
		if !resetPosition {
			WindowSetPosition(set.Position.Left, set.Position.Top)
		}
	}

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
			OpenInspectorOnStartup: false,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
