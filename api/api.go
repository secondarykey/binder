package api

import (
	. "binder/internal"
	"log/slog"

	"binder"
	"binder/log"

	"fmt"
)

// App struct
type App struct {
	current *binder.Binder
	version *Version
	devMode bool
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

// SetDevMode は開発モードフラグを設定する。
func (app *App) SetDevMode(dev bool) {
	app.devMode = dev
}

func (app *App) SetCurrent(c *binder.Binder) {
	defer log.PrintTrace(log.Func("SetCurrent()"))
	app.current = c
}


// VersionInfo はバージョン文字列と開発モードかどうかを返す
type VersionInfo struct {
	Version string `json:"version"`
	Dev     bool   `json:"dev"`
}

// GetVersionInfo はアプリのバージョン情報を返す
func (a *App) GetVersionInfo() (*VersionInfo, error) {
	info := &VersionInfo{
		Version: a.version.String(),
		Dev:     a.devMode,
	}
	return info, nil
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
