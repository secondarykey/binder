package main

import (
	"binder/api"
	"binder/fs"
	"binder/log"
	"binder/settings"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"golang.org/x/xerrors"
)

type Window struct {
	app *api.App

	runtime        *application.App
	window         *application.WebviewWindow
	commitWindow   *application.WebviewWindow
	historyWindows map[string]*application.WebviewWindow // key: typ+":"+id
	previewWindow  *application.WebviewWindow
	syslogWindow   *application.WebviewWindow
	searchWindow   *application.WebviewWindow
}

func NewWindow(app *api.App) *Window {
	var win Window
	win.app = app
	return &win
}

func (win *Window) OpenURL(url string) {
	win.runtime.Browser.OpenURL(url)
}

func (r *Window) OpenFileDialog(create bool, defaultDir string) (string, error) {

	dialog := r.runtime.Dialog.OpenFile().
		CanChooseDirectories(true).
		CanChooseFiles(false).
		CanCreateDirectories(create).
		SetTitle("Select Binder Directory")
	if defaultDir != "" {
		if _, err := os.Stat(defaultDir); err == nil {
			dialog.SetDirectory(defaultDir)
		}
	}

	result, err := dialog.PromptForSingleSelection()
	if err != nil {
		// ダイアログがキャンセルされた場合はエラーではなく空文字を返す
		if result == "" {
			return "", nil
		}
		return "", fmt.Errorf("OpenFileDialog() error\n%+v", err)
	}
	return result, nil
}

func (r *Window) OpenFilePicker(name, ptn string) (string, error) {
	result, err := r.runtime.Dialog.OpenFile().
		SetTitle("Select File").
		AddFilter(name, ptn).
		PromptForSingleSelection()
	if err != nil {
		// ダイアログがキャンセルされた場合はエラーではなく空文字を返す
		if result == "" {
			return "", nil
		}
		return "", fmt.Errorf("OpenFilePicker() error\n%+v", err)
	}
	return result, nil
}

func (win *Window) WindowSize() (int, int) {
	return win.window.Size()
}

func (r *Window) WindowPosition() (int, int) {
	return r.window.Position()
}

func (r *Window) OpenHistoryWindow(typ, id, name string) error {
	key := typ + ":" + id

	if r.historyWindows == nil {
		r.historyWindows = make(map[string]*application.WebviewWindow)
	}

	// 既に開いていれば前面に出すだけ
	if w, ok := r.historyWindows[key]; ok {
		w.Focus()
		return nil
	}

	w := r.runtime.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Binder - History",
		Width:            900,
		Height:           600,
		MinWidth:         600,
		MinHeight:        400,
		Frameless:        true,
		BackgroundColour: application.NewRGBA(27, 38, 54, 255),
		URL:              "/?history=1&type=" + typ + "&id=" + id + "&name=" + url.QueryEscape(name),
	})

	r.historyWindows[key] = w

	// ウィンドウが閉じられたらリセット
	w.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		delete(r.historyWindows, key)
	})

	return nil
}

func (r *Window) OpenPreviewWindow(typ, id, name string) error {
	// 既に開いていれば前面に出すだけ
	if r.previewWindow != nil {
		r.previewWindow.Focus()
		return nil
	}

	w := r.runtime.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Binder - Preview",
		Width:            800,
		Height:           600,
		MinWidth:         400,
		MinHeight:        300,
		Frameless:        true,
		BackgroundColour: application.NewRGBA(27, 38, 54, 255),
		URL:              "/?preview=1&type=" + typ + "&id=" + id + "&name=" + url.QueryEscape(name),
	})

	r.previewWindow = w

	// ウィンドウが閉じられたらリセット
	w.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		r.previewWindow = nil
	})

	return nil
}

// setting.go
func (win *Window) SavePosition() error {

	w, h := win.window.Size()
	x, y := win.window.Position()

	var pos settings.Position

	pos.Left = x
	pos.Top = y
	pos.Width = w
	pos.Height = h

	err := win.app.SavePosition(&pos)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("SaveSetting() error:\n%+v", err)
	}

	return nil
}

func (win *Window) SelectDirectory(create bool) (string, error) {
	defer log.PrintTrace(log.Func("SelectDirectory()"))

	s := settings.Get()
	dir, err := win.OpenFileDialog(create, s.Path.Default)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("SelectDirectory() error\n%+v", err)
	}
	return dir, nil
}

func (win *Window) SelectFile(name string, ptn string) (string, error) {
	defer log.PrintTrace(log.Func("SelectFile()"))

	selection, err := win.OpenFilePicker(name, ptn)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("SelectFile() error\n%+v", err)
	}
	return selection, nil
}

// SelectFileContent はファイル選択ダイアログを表示し、選択されたファイルの内容をテキストとして返す。
func (win *Window) SelectFileContent(name string, ptn string) (string, error) {
	defer log.PrintTrace(log.Func("SelectFileContent()"))

	selection, err := win.OpenFilePicker(name, ptn)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("SelectFileContent() error\n%+v", err)
	}
	if selection == "" {
		return "", nil
	}

	data, err := os.ReadFile(selection)
	if err != nil {
		return "", fmt.Errorf("ReadFile() error\n%+v", err)
	}
	return string(data), nil
}

func (win *Window) OpenBinderSite() error {
	defer log.PrintTrace(log.Func("OpenBinderSite()"))

	address, _ := win.app.Address()
	win.runtime.Browser.OpenURL(address)

	return nil
}

const (
	editorFileMark     = "{file}"
	editorBashFileMark = "{bfile}"
)

func (win *Window) RunEditor(mode, id string) error {
	defer log.PrintTrace(log.Func("RunEditor()", mode, id))

	editor := settings.GetEditor()
	program := editor.Program
	argsStr := editor.Args

	fn := win.app.GetFullPath(mode, id)
	log.Info(fn)

	ch, err := runEditor(program, argsStr, fn)
	if err != nil {
		return xerrors.Errorf("runEditor() error: %w", err)
	}

	err = <-ch
	if err != nil {
		return xerrors.Errorf("editor channel error: %w", err)
	}
	return nil
}

func runEditor(program, argsStr, fn string) (chan error, error) {

	if program == "" {
		return nil, xerrors.Errorf("editor program is not set")
	}

	if argsStr == "" {
		argsStr = editorFileMark
	}

	// {bfile} がある場合は GitBash 形式のパスに変換して置換
	bashFn := fs.ToGitBash(fn)

	// 引数をスペースで分割し、{file}/{bfile} を実パスに置換
	tokens := strings.Fields(argsStr)
	fm := false
	var args []string
	for _, token := range tokens {
		if strings.Contains(token, editorBashFileMark) {
			token = strings.ReplaceAll(token, editorBashFileMark, bashFn)
			fm = true
		}
		if strings.Contains(token, editorFileMark) {
			token = strings.ReplaceAll(token, editorFileMark, fn)
			fm = true
		}
		args = append(args, token)
	}

	if !fm {
		return nil, xerrors.Errorf("file mark[%s] error", editorFileMark)
	}

	exe := exec.Command(program, args...)
	err := exe.Start()
	if err != nil {
		return nil, xerrors.Errorf("command start error: %w", err)
	}

	ch := make(chan error)
	go func(ch chan error) {
		err := exe.Wait()
		ch <- err
	}(ch)

	return ch, nil
}

// DownloadDocs はdocsディレクトリをZIPファイルとしてダウンロードする。
// 保存先ダイアログを表示し、選択されたパスにZIPを書き出す。
func (win *Window) DownloadDocs() error {
	defer log.PrintTrace(log.Func("DownloadDocs()"))

	savePath, err := win.downloadSaveDialog("_docs")
	if err != nil {
		return err
	}
	if savePath == "" {
		return nil
	}

	err = win.app.DownloadDocs(savePath)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("DownloadDocs() error\n%+v", err)
	}

	return nil
}

// DownloadAll はバインダー全体をZIPファイルとしてダウンロードする。
// 保存先ダイアログを表示し、選択されたパスにZIPを書き出す。
func (win *Window) DownloadAll() error {
	defer log.PrintTrace(log.Func("DownloadAll()"))

	savePath, err := win.downloadSaveDialog("")
	if err != nil {
		return err
	}
	if savePath == "" {
		return nil
	}

	err = win.app.DownloadAll(savePath)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("DownloadAll() error\n%+v", err)
	}

	return nil
}

// downloadSaveDialog はダウンロード用の保存先ダイアログを表示し、保存パスを返す。
// suffix はファイル名のバインダー名の後に付加する文字列（例: "_docs"）。
func (win *Window) downloadSaveDialog(suffix string) (string, error) {

	// バインダー名を取得してファイル名を生成
	name, err := win.app.GetBinderName()
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("GetBinderName() error\n%+v", err)
	}

	// yyyyMMddHHmmss_{バインダー名}{suffix}.zip
	now := time.Now().Format("20060102150405")
	defaultName := fmt.Sprintf("%s_%s%s.zip", now, name, suffix)

	// 保存先ダイアログを表示
	savePath, err := win.runtime.Dialog.SaveFile().
		SetButtonText("Save").
		AddFilter("ZIP files", "*.zip").
		SetFilename(defaultName).
		PromptForSingleSelection()
	if err != nil {
		if savePath == "" {
			return "", nil
		}
		log.PrintStackTrace(err)
		return "", fmt.Errorf("SaveFile dialog error\n%+v", err)
	}

	return savePath, nil
}

func (r *Window) OpenSyslogWindow() error {
	// 既に開いていれば前面に出すだけ
	if r.syslogWindow != nil {
		r.syslogWindow.Focus()
		return nil
	}

	w := r.runtime.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Binder - System Log",
		Width:            900,
		Height:           500,
		MinWidth:         600,
		MinHeight:        300,
		Frameless:        true,
		BackgroundColour: application.NewRGBA(27, 38, 54, 255),
		URL:              "/?syslog=1",
	})

	r.syslogWindow = w

	w.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		r.syslogWindow = nil
	})

	return nil
}

// OpenSearchWindow はバインダー全体検索ウィンドウを開く。
// 既に開いていれば前面に出す。
func (r *Window) OpenSearchWindow() error {
	if r.searchWindow != nil {
		r.searchWindow.Focus()
		return nil
	}

	w := r.runtime.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Binder - Search",
		Width:            700,
		Height:           46,
		MinWidth:         500,
		MinHeight:        46,
		Frameless:        true,
		AlwaysOnTop:      true,
		BackgroundColour: application.NewRGBA(27, 38, 54, 255),
		URL:              "/?search=1",
	})

	r.searchWindow = w
	w.SetAlwaysOnTop(true)

	w.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		r.searchWindow = nil
	})

	return nil
}

// SetLogLevel はログレベルを動的に変更する。
func (r *Window) SetLogLevel(level int) {
	log.SetLevel(slog.Level(level))
}

// GetLogLevel は現在のログレベルを返す。
func (r *Window) GetLogLevel() int {
	return int(log.GetLevel())
}

// ReadLogTail はログファイルの末尾を読み取って返す。
// offset が指定された場合、そのバイト位置以降の新しい内容のみを返す。
func (r *Window) ReadLogTail(offset int64) (map[string]interface{}, error) {
	path := log.Path()
	if path == "" {
		return map[string]interface{}{
			"content": "",
			"offset":  int64(0),
		}, nil
	}

	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("ReadLogTail() open error: %+v", err)
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("ReadLogTail() stat error: %+v", err)
	}

	size := info.Size()

	// 初回呼び出し（offset=0）: 末尾から最大 64KB を読む
	if offset <= 0 {
		readStart := size - 64*1024
		if readStart < 0 {
			readStart = 0
		}
		buf := make([]byte, size-readStart)
		_, err = f.ReadAt(buf, readStart)
		if err != nil {
			return nil, fmt.Errorf("ReadLogTail() read error: %+v", err)
		}
		return map[string]interface{}{
			"content": string(buf),
			"offset":  size,
		}, nil
	}

	// 差分読み取り
	if offset >= size {
		return map[string]interface{}{
			"content": "",
			"offset":  size,
		}, nil
	}

	buf := make([]byte, size-offset)
	_, err = f.ReadAt(buf, offset)
	if err != nil {
		return nil, fmt.Errorf("ReadLogTail() read error: %+v", err)
	}
	return map[string]interface{}{
		"content": string(buf),
		"offset":  size,
	}, nil
}

func (win *Window) Terminate() bool {

	//TODO ログに出力
	err := win.SavePosition()
	if err != nil {
	}

	err = win.app.CloseBinder()
	if err != nil {
	}

	win.runtime.Quit()
	return false
}
