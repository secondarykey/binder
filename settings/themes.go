package settings

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"golang.org/x/xerrors"
)

const (
	ThemesDirName  = "themes"
	DefaultDirName = "_default"
)

// ThemeInfo はテーマの識別情報を保持する。
type ThemeInfo struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

// ThemesDirPath は ~/.binder/themes のパスを返す。
func ThemesDirPath() string {
	return filepath.Join(DirPath(), ThemesDirName)
}

// DefaultThemesDirPath は ~/.binder/themes/_default のパスを返す。
func DefaultThemesDirPath() string {
	return filepath.Join(ThemesDirPath(), DefaultDirName)
}

// ListThemes は利用可能なテーマ一覧を返す。
// _default/ とユーザーディレクトリの両方をスキャンし、同名はユーザー側を優先する。
func ListThemes() ([]ThemeInfo, error) {

	themes := make(map[string]ThemeInfo)

	// _default/ をスキャン
	defDir := DefaultThemesDirPath()
	if entries, err := os.ReadDir(defDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".css") {
				continue
			}
			id := strings.TrimSuffix(e.Name(), ".css")
			name := parseThemeName(filepath.Join(defDir, e.Name()), id)
			themes[id] = ThemeInfo{Id: id, Name: name}
		}
	}

	// ユーザーディレクトリをスキャン（同名はユーザー側で上書き）
	userDir := ThemesDirPath()
	if entries, err := os.ReadDir(userDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".css") {
				continue
			}
			id := strings.TrimSuffix(e.Name(), ".css")
			name := parseThemeName(filepath.Join(userDir, e.Name()), id)
			themes[id] = ThemeInfo{Id: id, Name: name}
		}
	}

	result := make([]ThemeInfo, 0, len(themes))
	for _, t := range themes {
		result = append(result, t)
	}
	return result, nil
}

// ReadThemeCSS は指定IDのテーマCSSを読み込んで返す。
// ユーザーディレクトリを優先し、なければ _default/ から読む。
func ReadThemeCSS(id string) (string, error) {

	if err := validateId(id); err != nil {
		return "", err
	}

	// ユーザーディレクトリを優先
	userFile := filepath.Join(ThemesDirPath(), id+".css")
	if data, err := os.ReadFile(userFile); err == nil {
		return string(data), nil
	}

	// _default/ にフォールバック
	defFile := filepath.Join(DefaultThemesDirPath(), id+".css")
	data, err := os.ReadFile(defFile)
	if err != nil {
		return "", xerrors.Errorf("theme %q not found: %w", id, err)
	}
	return string(data), nil
}

var themeNameRe = regexp.MustCompile(`^/\*\s*@theme-name:\s*(.+?)\s*\*/`)

// parseThemeName はCSSファイルの1行目から @theme-name を抽出する。
// 見つからなければ fallback を返す。
func parseThemeName(path string, fallback string) string {

	f, err := os.Open(path)
	if err != nil {
		return fallback
	}
	defer f.Close()

	buf := make([]byte, 256)
	n, err := f.Read(buf)
	if err != nil || n == 0 {
		return fallback
	}

	// 最初の行を取得
	line := string(buf[:n])
	if idx := strings.Index(line, "\n"); idx >= 0 {
		line = line[:idx]
	}
	line = strings.TrimSpace(line)

	matches := themeNameRe.FindStringSubmatch(line)
	if len(matches) >= 2 {
		return matches[1]
	}
	return fallback
}

// validateId はIDにパストラバーサル文字が含まれていないか検証する。
func validateId(id string) error {
	if id == "" {
		return xerrors.Errorf("id is empty")
	}
	if strings.Contains(id, "/") || strings.Contains(id, "\\") || strings.Contains(id, "..") {
		return xerrors.Errorf("invalid id: %q", id)
	}
	return nil
}
