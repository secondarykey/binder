package api

import (
	. "binder/internal"

	"binder"
	"binder/i18n"
	"binder/log"
	"context"
	"fmt"
)

// SearchEmitter は検索イベントの発火を外部に委譲するインターフェース
type SearchEmitter interface {
	EmitResult(result binder.SearchResult)
	EmitDone()
}

// BinderWindowCloser はバインダー切り替え時に関連ウィンドウを閉じるインターフェース
type BinderWindowCloser interface {
	CloseBinderWindows()
}

// App struct
type App struct {
	current       *binder.Binder
	version       *Version
	devMode       bool
	searchCancel  context.CancelFunc
	SearchEmitter SearchEmitter
	WindowCloser  BinderWindowCloser
}

func New(version string) *App {

	var app App
	var err error
	app.version, err = NewVersion(version)
	if err != nil {
		log.Warn("Version parse error:\n%+v", err)
	}
	log.Notice("Binder Version: %v", app.version)

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
		return fmt.Errorf("%s", i18n.T("go.error.binderNotOpened"))
	}
	if a.SearchEmitter == nil {
		return fmt.Errorf("%s", i18n.T("go.error.emitterNotSet"))
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

// Address はバインダーを一意に識別するための安定した識別子（バインダーのディレクトリ）を返す。
// 以前は HTTPサーバのURLを返していたが、サーバは遅延起動になったため、
// フロントエンドの「別バインダーへ切り替わったか」判定にはサーバ非依存の識別子を使う。
// 実際にブラウザで開くためのサーバURLは EnsureAddress() を使うこと。
func (a *App) Address() (string, error) {
	defer log.PrintTrace(log.Func("Address()"))
	return a.current.Dir(), nil
}

// EnsureAddress は HTTPサーバを（未起動なら）起動し、その http URL を返す。
// 「ブラウザで開く」など公開サイト確認が必要になった時点で呼ぶ。
func (a *App) EnsureAddress() (string, error) {
	defer log.PrintTrace(log.Func("EnsureAddress()"))
	addr, err := a.current.EnsureServing()
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("EnsureAddress() error\n%+v", err)
	}
	return fmt.Sprintf("http://%s", addr), nil
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
