package api

import (
	. "binder/internal"
	"log/slog"

	"binder"
	"binder/log"
	"binder/settings"

	"fmt"
	"os"
)

// AppRuntime はデスクトップ環境の操作を抽象化するインターフェース。
// 具体的な実装（Wails v3 等）は _cmd/binder 層で提供し、
// binder パッケージ自体が Wails v3 に依存しない設計とする。
type AppRuntime interface {
	// Quit はアプリケーションを終了する
	Quit()
	// OpenURL はシステムのデフォルトブラウザで URL を開く
	OpenURL(url string)
	// OpenFileDialog はディレクトリ選択ダイアログを表示し、選択パスを返す。
	// defaultDir が空文字の場合はデフォルト動作に従う。
	OpenFileDialog(create bool, defaultDir string) (string, error)
	// OpenFilePicker はファイル選択ダイアログを表示し、選択パスを返す
	OpenFilePicker(name, ptn string) (string, error)
	// WindowSize は現在のウィンドウサイズ（幅, 高さ）を返す
	WindowSize() (int, int)
	// WindowPosition は現在のウィンドウ位置（x, y）を返す
	WindowPosition() (int, int)
	// OpenModifiedWindow はコミットウィンドウを開く（既に開いていれば前面に出す）
	OpenModifiedWindow() error
	// OpenHistoryWindow は指定ファイルの履歴ウィンドウを開く（既に開いていれば前面に出す）
	OpenHistoryWindow(typ, id string) error
}

// App struct
type App struct {
	runtime AppRuntime
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

// SetRuntime は AppRuntime の実装を注入する。
// Wails v3 を使う場合は _cmd/binder/main.go 内で呼び出す。
func (a *App) SetRuntime(r AppRuntime) {
	a.runtime = r
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

func (a *App) Terminate() bool {

	defer log.PrintTrace(log.Func("Terminate()"))

	if a.current != nil {
		err := a.current.Close()
		if err != nil {
			log.PrintStackTrace(err)
			os.Exit(1)
		}
	}
	a.runtime.Quit()
	return false
}

func (a *App) SelectDirectory(create bool) (string, error) {

	defer log.PrintTrace(log.Func("SelectDirectory()"))

	s := settings.Get()
	dir, err := a.runtime.OpenFileDialog(create, s.Path.Default)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("SelectDirectory() error\n%+v", err)
	}
	return dir, nil
}

func (a *App) SelectFile(name string, ptn string) (string, error) {

	defer log.PrintTrace(log.Func("SelectFile()"))

	selection, err := a.runtime.OpenFilePicker(name, ptn)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("SelectFile() error\n%+v", err)
	}
	return selection, nil
}

func (a *App) OpenBinderSite() error {

	defer log.PrintTrace(log.Func("OpenBinderSite()"))

	address, _ := a.Address()
	a.runtime.OpenURL(address)

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
