package api

import (
	. "binder/internal"
	"log/slog"

	"binder"
	"binder/log"
	"binder/settings"

	"fmt"
)

// App struct
type App struct {
	current *binder.Binder
	version *Version
}

func New(version string) *App {

	var app App
	var err error
	app.version, err = NewVersion(version)
	if err != nil {
		slog.Warn(fmt.Sprintf("Version parse error: %+v", err))
	}
	log.Notice(fmt.Sprintf("Binder Version: %s", app.version))

	return &app
}

func (app *App) SetCurrent(c *binder.Binder) {
	defer log.PrintTrace(log.Func("SetCurrent()"))
	app.current = c
}

// Startup は起動時の初期化処理を行う。
// Wails v3 の ServiceStartup とは切り離されており、main() から直接呼び出せる。
func (a *App) Startup() error {

	defer log.PrintTrace(log.Func("Startup()"))

	// デフォルト snippets.json を ~/.binder/snippets.json に配置（初回起動時のみ）
	if err := binder.InstallSnippets(); err != nil {
		log.PrintStackTrace(err)
	}

	set := settings.Get()
	//起動時にひらく設定
	if set.Path.RunWithOpen {
		his := set.Path.Histories
		if len(his) > 0 {
			b, err := binder.Load(his[0], a.version)
			if err != nil {
				log.PrintStackTrace(err)
			} else {
				a.SetCurrent(b)
				err = b.Serve()
				if err != nil {
					log.PrintStackTrace(err)
				}
			}
		}
	}

	return nil
}

func (a *App) Address() (string, error) {
	defer log.PrintTrace(log.Func("Address()"))
	return fmt.Sprintf("http://%s", a.current.ServerAddress()), nil
}

type KVList []*KeyValue

func newKVList(cp int) KVList {
	rtn := make([]*KeyValue, 0, cp)
	return rtn
}

func (l KVList) Add(k, v string) KVList {
	l = append(l, newKV(k, v))
	return l
}

type KeyValue struct {
	Key   string
	Value string
}

func newKV(k, v string) *KeyValue {
	var kv KeyValue
	kv.Key = k
	kv.Value = v
	return &kv
}
