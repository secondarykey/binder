package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

const (
	LanguagesDirName = "languages"
)

// LanguageInfo は言語の識別情報を保持する。
type LanguageInfo struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

// LanguagesDirPath は ~/.binder/languages のパスを返す。
func LanguagesDirPath() string {
	return filepath.Join(DirPath(), LanguagesDirName)
}

// DefaultLanguagesDirPath は ~/.binder/languages/_default のパスを返す。
func DefaultLanguagesDirPath() string {
	return filepath.Join(LanguagesDirPath(), DefaultDirName)
}

// ListLanguages は利用可能な言語一覧を返す。
// _default/ とユーザーディレクトリの両方をスキャンし、同名はユーザー側を優先する。
func ListLanguages() ([]LanguageInfo, error) {

	langs := make(map[string]LanguageInfo)

	// _default/ をスキャン
	defDir := DefaultLanguagesDirPath()
	if entries, err := os.ReadDir(defDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			code := strings.TrimSuffix(e.Name(), ".json")
			name := parseLanguageName(filepath.Join(defDir, e.Name()), code)
			langs[code] = LanguageInfo{Code: code, Name: name}
		}
	}

	// ユーザーディレクトリをスキャン（同名はユーザー側で上書き）
	userDir := LanguagesDirPath()
	if entries, err := os.ReadDir(userDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			code := strings.TrimSuffix(e.Name(), ".json")
			name := parseLanguageName(filepath.Join(userDir, e.Name()), code)
			langs[code] = LanguageInfo{Code: code, Name: name}
		}
	}

	result := make([]LanguageInfo, 0, len(langs))
	for _, l := range langs {
		result = append(result, l)
	}
	return result, nil
}

// ReadLanguageJSON は指定コードの言語JSONを読み込んで返す。
// ユーザーディレクトリを優先し、なければ _default/ から読む。
func ReadLanguageJSON(code string) (string, error) {

	if err := validateId(code); err != nil {
		return "", err
	}

	// ユーザーディレクトリを優先
	userFile := filepath.Join(LanguagesDirPath(), code+".json")
	if data, err := os.ReadFile(userFile); err == nil {
		return string(data), nil
	}

	// _default/ にフォールバック
	defFile := filepath.Join(DefaultLanguagesDirPath(), code+".json")
	data, err := os.ReadFile(defFile)
	if err != nil {
		return "", xerrors.Errorf("language %q not found: %w", code, err)
	}
	return string(data), nil
}

// parseLanguageName はJSONファイルから "code" キーの値を抽出する。
// 見つからなければ fallback を返す。
func parseLanguageName(path string, fallback string) string {

	data, err := os.ReadFile(path)
	if err != nil {
		return fallback
	}

	var obj map[string]interface{}
	if err := json.Unmarshal(data, &obj); err != nil {
		return fallback
	}

	if name, ok := obj["code"].(string); ok && name != "" {
		return name
	}
	return fallback
}
