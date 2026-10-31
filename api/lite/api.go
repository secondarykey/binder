package lite

import (
	"binder/log"
	"binder/settings"
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

// App は binder-lite の Wails v3 Service。
// ファイルI/O とテーマ・言語の提供のみを担当する。
type App struct {
	version      string
	initialFiles []string
}

// New は App を生成する。
func New(version string) *App {
	return &App{version: version}
}

// SetInitialFiles は起動時に開くファイルパスを設定する。
// 存在しないパスは除外される。
func (a *App) SetInitialFiles(paths []string) {
	valid := make([]string, 0, len(paths))
	for _, p := range paths {
		info, err := os.Stat(p)
		if err != nil || info.IsDir() {
			continue
		}
		valid = append(valid, p)
	}
	a.initialFiles = valid
}

// InitialFiles は起動時に開くファイルパスのリストを返す。
func (a *App) InitialFiles() []string {
	return a.initialFiles
}

// Version はアプリバージョンを返す。
func (a *App) Version() string {
	return a.version
}

// ReadFile は指定パスのファイル内容をテキストとして返す。
func (a *App) ReadFile(path string) (string, error) {
	defer log.PrintTrace(log.Func("ReadFile()", path))

	data, err := os.ReadFile(path)
	if err != nil {
		return "", xerrors.Errorf("ReadFile(%s) error: %w", path, err)
	}
	return string(data), nil
}

// SaveFile は指定パスにテキストを書き込む。
// アトミック書き込み（一時ファイル→リネーム）で安全に保存する。
func (a *App) SaveFile(path, content string) error {
	defer log.PrintTrace(log.Func("SaveFile()", path))

	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".binder-lite-*.tmp")
	if err != nil {
		return xerrors.Errorf("CreateTemp() error: %w", err)
	}
	tmpName := tmp.Name()

	if _, err := tmp.WriteString(content); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return xerrors.Errorf("WriteString() error: %w", err)
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return xerrors.Errorf("Close() error: %w", err)
	}
	if err := os.Rename(tmpName, path); err != nil {
		os.Remove(tmpName)
		return xerrors.Errorf("Rename() error: %w", err)
	}
	return nil
}

// --- ワーク（保存前の Untitled タブ） ---

// ListWorks は保存されているワークを連番順に返す。
func (a *App) ListWorks() ([]*settings.LiteWork, error) {
	defer log.PrintTrace(log.Func("ListWorks()"))
	return settings.ListLiteWorks()
}

// CreateWork は未使用の名前でワークを作成し、その名前（Untitled / Untitled-2 ...）を返す。
func (a *App) CreateWork() (string, error) {
	defer log.PrintTrace(log.Func("CreateWork()"))
	return settings.CreateLiteWork()
}

// SaveWork はワークの内容を保存する。
func (a *App) SaveWork(name, content string) error {
	defer log.PrintTrace(log.Func("SaveWork()", name))
	return settings.SaveLiteWork(name, content)
}

// DeleteWork はワークを削除する。ファイルとして保存した場合や破棄した場合に呼ぶ。
func (a *App) DeleteWork(name string) error {
	defer log.PrintTrace(log.Func("DeleteWork()", name))
	return settings.DeleteLiteWork(name)
}

// --- 画像（Markdown ファイルの隣の <ファイル名>.assets/） ---

// SaveImage は貼り付けた画像を保存し、本文に書く相対パスを返す。
// docPath が空ならワーク（work）の画像として保存する。data は base64、ext は拡張子。
func (a *App) SaveImage(docPath, work, data, ext string) (string, error) {
	defer log.PrintTrace(log.Func("SaveImage()", docPath, work, ext))
	return settings.SaveLiteImage(docPath, work, data, ext)
}

// ReadImage は本文の相対パスの画像を data URI で返す（プレビュー用）。
func (a *App) ReadImage(docPath, work, src string) (string, error) {
	return settings.ReadLiteImage(docPath, work, src)
}

// RelocateImages は保存先が変わるときに本文が参照する画像を写し、パスを書き換えた本文を返す。
// 一部の画像を写せなくても保存は止めない（写せたものだけ書き換えた本文を返し、失敗はログに残す）。
func (a *App) RelocateImages(fromPath, fromWork, toPath, content string) (string, error) {
	defer log.PrintTrace(log.Func("RelocateImages()", fromPath, fromWork, toPath))
	out, err := settings.RelocateLiteAssets(fromPath, fromWork, toPath, content)
	if err != nil {
		log.Warnf("RelocateLiteAssets() error:\n%+v", err)
	}
	return out, nil
}

// --- lite 固有設定（setting-lite.json） ---

// GetTheme は現在のテーマIDを返す。
func (a *App) GetTheme() string {
	return settings.GetLite().Theme
}

// SetTheme はテーマIDを保存する。
func (a *App) SetTheme(theme string) error {
	return settings.SaveLiteTheme(theme)
}

// GetLanguage は現在の言語コードを返す。
func (a *App) GetLanguage() string {
	return settings.GetLite().Language
}

// SetLanguage は言語コードを保存する。
func (a *App) SetLanguage(lang string) error {
	if err := settings.SaveLiteLanguage(lang); err != nil {
		return err
	}
	settings.SetI18nLanguage(lang)
	return nil
}

// GetEditorSettings はエディタ設定を返す。
func (a *App) GetEditorSettings() map[string]any {
	s := settings.GetLite()
	return map[string]any{
		"showLineNumbers": s.ShowLineNumbers,
		"wordWrap":        s.WordWrap,
		"tabSize":         s.TabSize,
	}
}

// SaveEditorSettings はエディタ設定を保存する。
func (a *App) SaveEditorSettings(showLineNumbers, wordWrap bool, tabSize int) error {
	return settings.SaveLiteEditor(showLineNumbers, wordWrap, tabSize)
}

// GetFont は指定テーマのフォント設定を返す。
func (a *App) GetFont(theme string) *settings.Font {
	return settings.GetLiteFont(theme)
}

// SaveFont は指定テーマのフォント設定を保存する。
func (a *App) SaveFont(theme string, f *settings.Font) error {
	return settings.SaveLiteFont(theme, f)
}

// 以下のメソッドは api/shared パッケージに移動:
// GetFontNames, GetThemeList, GetThemeCSS, GetLanguageList, GetLanguageData,
// GetLicense, GetThirdPartyLicenses

// --- プレビューテンプレート ---

// GetPreviewHTML はテンプレートと CSS を結合したプレビュー用 HTML を返す。
// content にはパース済みの HTML ボディを渡す。
func (a *App) GetPreviewHTML(theme string, content string) (string, error) {
	return settings.BuildLitePreviewHTML(theme, content)
}

// OpenPreviewFiles はプレビュー CSS とテンプレートのユーザー編集用ファイルパスを返す。
// ユーザーディレクトリにファイルがなければ _default/ からコピーする。
func (a *App) OpenPreviewFiles(theme string) ([]string, error) {
	cssPath, tmplPath, err := settings.EnsureLitePreviewFiles(theme)
	if err != nil {
		return nil, err
	}
	return []string{cssPath, tmplPath}, nil
}
