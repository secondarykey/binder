package i18n

import (
	"binder/settings"
	"encoding/json"
	"sync"
)

var (
	mu        sync.RWMutex
	messages  map[string]string
	langCode  string
	callbacks []func(string)
)

// Init は指定された言語コードで翻訳マップを初期化する。
// settings.ReadLanguageJSON が使えるタイミング（EnsureDir 後）で呼ぶこと。
func Init(code string) error {
	if code == "" {
		code = "en"
	}
	return load(code)
}

// T はキーに対応する翻訳文字列を返す。
// キーが見つからない場合はキー自体を返す。
func T(key string) string {
	mu.RLock()
	defer mu.RUnlock()
	if v, ok := messages[key]; ok {
		return v
	}
	return key
}

// SetLanguage は実行時に言語を切り替え、登録済みコールバックを呼ぶ。
// 実際に設定された言語コードを返す。
func SetLanguage(code string) string {
	if code == "" {
		code = "en"
	}
	if err := load(code); err != nil {
		if code != "en" {
			load("en")
		}
	}

	mu.RLock()
	cbs := make([]func(string), len(callbacks))
	copy(cbs, callbacks)
	current := langCode
	mu.RUnlock()

	for _, fn := range cbs {
		fn(current)
	}
	return current
}

// OnLanguageChange は言語変更時に呼ばれるコールバックを登録する。
func OnLanguageChange(fn func(string)) {
	mu.Lock()
	defer mu.Unlock()
	callbacks = append(callbacks, fn)
}

// Lang は現在の言語コードを返す。
func Lang() string {
	mu.RLock()
	defer mu.RUnlock()
	return langCode
}

func load(code string) error {
	jsonStr, err := settings.ReadLanguageJSON(code)
	if err != nil {
		return err
	}

	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &raw); err != nil {
		return err
	}

	flat := make(map[string]string)
	flatten("", raw, flat)

	mu.Lock()
	messages = flat
	langCode = code
	mu.Unlock()
	return nil
}

func flatten(prefix string, m map[string]interface{}, out map[string]string) {
	for k, v := range m {
		key := k
		if prefix != "" {
			key = prefix + "." + k
		}
		switch val := v.(type) {
		case string:
			out[key] = val
		case map[string]interface{}:
			flatten(key, val, out)
		}
	}
}
