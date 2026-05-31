package settings

import (
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

const (
	LiteDirName = "lite"
)

// LiteDirPath は ~/.binder/lite のパスを返す。
func LiteDirPath() string {
	return filepath.Join(DirPath(), LiteDirName)
}

// DefaultLiteDirPath は ~/.binder/lite/_default のパスを返す。
func DefaultLiteDirPath() string {
	return filepath.Join(LiteDirPath(), DefaultDirName)
}

// ReadLitePreviewCSS は指定テーマのプレビュー CSS を読み込んで返す。
// ユーザーディレクトリを優先し、なければ _default/ から読む。
func ReadLitePreviewCSS(theme string) (string, error) {

	name := "preview-" + theme + ".css"

	// ユーザーディレクトリを優先
	userFile := filepath.Join(LiteDirPath(), name)
	if data, err := os.ReadFile(userFile); err == nil {
		return string(data), nil
	}

	// _default/ にフォールバック
	defFile := filepath.Join(DefaultLiteDirPath(), name)
	data, err := os.ReadFile(defFile)
	if err != nil {
		return "", xerrors.Errorf("lite preview CSS %q not found: %w", name, err)
	}
	return string(data), nil
}

// ReadLiteTemplate はプレビューテンプレート HTML を読み込んで返す。
// ユーザーディレクトリを優先し、なければ _default/ から読む。
func ReadLiteTemplate() (string, error) {

	name := "template.html"

	// ユーザーディレクトリを優先
	userFile := filepath.Join(LiteDirPath(), name)
	if data, err := os.ReadFile(userFile); err == nil {
		return string(data), nil
	}

	// _default/ にフォールバック
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
