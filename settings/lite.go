package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

const (
	LiteDirName          = "lite"
	LiteSettingsFileName = "setting-lite.json"
)

// LiteSetting は binder-lite 固有の設定。
type LiteSetting struct {
	Theme           string           `json:"theme"`
	Language        string           `json:"language"`
	ShowLineNumbers bool             `json:"showLineNumbers"`
	WordWrap        bool             `json:"wordWrap"`
	Position        *Position        `json:"position"`
	ThemeFonts      []*LiteThemeFont `json:"themeFont"`
}

// LiteThemeFont はテーマごとのフォント設定。
type LiteThemeFont struct {
	Theme string `json:"theme"`
	Font  *Font  `json:"font"`
}

var pLiteSet *LiteSetting

// liteSettingsPath は ~/.binder/setting-lite.json のパスを返す。
func liteSettingsPath() string {
	return filepath.Join(DirPath(), LiteSettingsFileName)
}

func liteDef() *LiteSetting {
	return &LiteSetting{
		Theme:           "system",
		Language:        "en",
		ShowLineNumbers: true,
		WordWrap:        true,
		Position: &Position{
			Left:   -9999,
			Top:    -9999,
			Width:  1280,
			Height: 768,
		},
		ThemeFonts: []*LiteThemeFont{
			{
				Theme: "dark",
				Font: &Font{
					Name:            "monospace",
					Color:           "#e0e0e0",
					BackgroundColor: "#1e1e1e",
					Size:            14,
				},
			},
			{
				Theme: "light",
				Font: &Font{
					Name:            "monospace",
					Color:           "#333333",
					BackgroundColor: "#ffffff",
					Size:            14,
				},
			},
		},
	}
}

// GetLite は lite 設定を返す（遅延読み込み）。
func GetLite() *LiteSetting {
	if pLiteSet == nil {
		s, err := loadLite()
		if err != nil {
			pLiteSet = liteDef()
		} else {
			pLiteSet = s
		}
		// nil フィールドの補完
		if pLiteSet.Position == nil {
			pLiteSet.Position = liteDef().Position
		}
		if pLiteSet.ThemeFonts == nil {
			pLiteSet.ThemeFonts = liteDef().ThemeFonts
		}
	}
	return pLiteSet
}

func loadLite() (*LiteSetting, error) {
	p := liteSettingsPath()
	data, err := os.ReadFile(p)
	if err != nil {
		return nil, xerrors.Errorf("os.ReadFile(%s) error: %w", p, err)
	}
	var s LiteSetting
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, xerrors.Errorf("json.Unmarshal() error: %w", err)
	}
	return &s, nil
}

func (s *LiteSetting) save() error {
	p := liteSettingsPath()
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return xerrors.Errorf("json.MarshalIndent() error: %w", err)
	}
	if err := os.WriteFile(p, data, 0644); err != nil {
		return xerrors.Errorf("os.WriteFile(%s) error: %w", p, err)
	}
	return nil
}

// SaveLiteTheme はテーマを保存する。
func SaveLiteTheme(theme string) error {
	s := GetLite()
	s.Theme = theme
	return s.save()
}

// SaveLiteLanguage は言語を保存する。
func SaveLiteLanguage(lang string) error {
	s := GetLite()
	s.Language = lang
	return s.save()
}

// SaveLiteEditor は行番号とテキスト折り返しの設定を保存する。
func SaveLiteEditor(showLineNumbers, wordWrap bool) error {
	s := GetLite()
	s.ShowLineNumbers = showLineNumbers
	s.WordWrap = wordWrap
	return s.save()
}

// GetLiteFont は指定テーマのフォント設定を返す。
func GetLiteFont(theme string) *Font {
	s := GetLite()
	for _, tf := range s.ThemeFonts {
		if tf.Theme == theme {
			return tf.Font
		}
	}
	return nil
}

// SaveLiteFont は指定テーマのフォント設定を保存する。
func SaveLiteFont(theme string, f *Font) error {
	s := GetLite()
	for _, tf := range s.ThemeFonts {
		if tf.Theme == theme {
			tf.Font = f
			return s.save()
		}
	}
	// 該当テーマがなければ追加
	s.ThemeFonts = append(s.ThemeFonts, &LiteThemeFont{Theme: theme, Font: f})
	return s.save()
}

// SaveLitePosition はウィンドウ位置を保存する。
func SaveLitePosition(pos *Position) error {
	s := GetLite()
	s.Position = pos
	return s.save()
}

// --- プレビューテンプレート ---

// LiteDirPath は ~/.binder/lite のパスを返す。
func LiteDirPath() string {
	return filepath.Join(DirPath(), LiteDirName)
}

// DefaultLiteDirPath は ~/.binder/lite/_default のパスを返す。
func DefaultLiteDirPath() string {
	return filepath.Join(LiteDirPath(), DefaultDirName)
}

// ReadLitePreviewCSS は指定テーマのプレビュー CSS を読み込んで返す。
func ReadLitePreviewCSS(theme string) (string, error) {
	name := "preview-" + theme + ".css"
	userFile := filepath.Join(LiteDirPath(), name)
	if data, err := os.ReadFile(userFile); err == nil {
		return string(data), nil
	}
	defFile := filepath.Join(DefaultLiteDirPath(), name)
	data, err := os.ReadFile(defFile)
	if err != nil {
		return "", xerrors.Errorf("lite preview CSS %q not found: %w", name, err)
	}
	return string(data), nil
}

// ReadLiteTemplate はプレビューテンプレート HTML を読み込んで返す。
func ReadLiteTemplate() (string, error) {
	name := "template.html"
	userFile := filepath.Join(LiteDirPath(), name)
	if data, err := os.ReadFile(userFile); err == nil {
		return string(data), nil
	}
	defFile := filepath.Join(DefaultLiteDirPath(), name)
	data, err := os.ReadFile(defFile)
	if err != nil {
		return "", xerrors.Errorf("lite template %q not found: %w", name, err)
	}
	return string(data), nil
}

// BuildLitePreviewHTML はテンプレートと CSS を結合してプレビュー HTML を生成する。
func BuildLitePreviewHTML(theme string, content string) (string, error) {
	tmpl, err := ReadLiteTemplate()
	if err != nil {
		return "", xerrors.Errorf("ReadLiteTemplate() error: %w", err)
	}
	css, err := ReadLitePreviewCSS(theme)
	if err != nil {
		return "", xerrors.Errorf("ReadLitePreviewCSS(%s) error: %w", theme, err)
	}
	html := strings.Replace(tmpl, "{{style}}", css, 1)
	html = strings.Replace(html, "{{content}}", content, 1)
	return html, nil
}
