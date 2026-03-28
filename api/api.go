package api

import (
	. "binder/internal"

	"binder"
	"binder/log"
	"context"
	"fmt"
)

// SearchEmitter は検索イベントの発火を外部に委譲するインターフェース
type SearchEmitter interface {
	EmitResult(result binder.SearchResult)
	EmitDone()
}

// App struct
type App struct {
	current        *binder.Binder
	version        *Version
	devMode        bool
	searchCancel   context.CancelFunc
	SearchEmitter  SearchEmitter
}

func New(version string) *App {

	var app App
	var err error
	app.version, err = NewVersion(version)
	if err != nil {
		log.WarnE("Version parse error", err)
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

// SearchBinder はバインダー内の全ノート・ダイアグラムを非同期で検索する。
// 結果は SearchEmitter 経由でイベントとして返される。
func (a *App) SearchBinder(query string) error {
	if a.current == nil {
		return fmt.Errorf("binder is not opened")
	}
	if a.SearchEmitter == nil {
		return fmt.Errorf("search emitter is not set")
	}
	// 前回の検索をキャンセル
	if a.searchCancel != nil {
		a.searchCancel()
	}
	ctx, cancel := context.WithCancel(context.Background())
	a.searchCancel = cancel
	emitter := a.SearchEmitter
	go func() {
		a.current.Search(ctx, query, func(result binder.SearchResult) {
			emitter.EmitResult(result)
		})
		emitter.EmitDone()
	}()
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
