package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"golang.org/x/xerrors"
)

var (
	i18nMu        sync.RWMutex
	i18nMessages  map[string]string
	i18nLangCode  string
	i18nCallbacks []func(string)
)

// InitI18n は指定された言語コードで翻訳マップを初期化する。
// EnsureExists 後（言語ファイルが配置済み）のタイミングで呼ぶこと。
func InitI18n(code string) error {
	if code == "" {
		code = "en"
	}
	return loadI18n(code)
}

// T はキーに対応する翻訳文字列を返す。
// キーが見つからない場合はキー自体を返す。
func T(key string) string {
	i18nMu.RLock()
	defer i18nMu.RUnlock()
	if v, ok := i18nMessages[key]; ok {
		return v
	}
	return key
}

// SetI18nLanguage は実行時に言語を切り替え、登録済みコールバックを呼ぶ。
// 実際に設定された言語コードを返す。
func SetI18nLanguage(code string) string {
	if code == "" {
		code = "en"
	}
	if err := loadI18n(code); err != nil {
		if code != "en" {
			loadI18n("en")
		}
	}

	i18nMu.RLock()
	cbs := make([]func(string), len(i18nCallbacks))
	copy(cbs, i18nCallbacks)
	current := i18nLangCode
	i18nMu.RUnlock()

	for _, fn := range cbs {
		fn(current)
	}
	return current
}

// OnLanguageChange は言語変更時に呼ばれるコールバックを登録する。
func OnLanguageChange(fn func(string)) {
	i18nMu.Lock()
	defer i18nMu.Unlock()
	i18nCallbacks = append(i18nCallbacks, fn)
}

// I18nLang は現在の言語コードを返す。
func I18nLang() string {
	i18nMu.RLock()
	defer i18nMu.RUnlock()
	return i18nLangCode
}

func loadI18n(code string) error {
	jsonStr, err := ReadLanguageJSON(code)
	if err != nil {
		return err
	}

	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &raw); err != nil {
		return err
	}

	flat := make(map[string]string)
	flattenJSON("", raw, flat)

	i18nMu.Lock()
	i18nMessages = flat
	i18nLangCode = code
	i18nMu.Unlock()
	return nil
}

func flattenJSON(prefix string, m map[string]interface{}, out map[string]string) {
	for k, v := range m {
		key := k
		if prefix != "" {
			key = prefix + "." + k
		}
		switch val := v.(type) {
		case string:
			out[key] = val
		case map[string]interface{}:
			flattenJSON(key, val, out)
		}
	}
}

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
