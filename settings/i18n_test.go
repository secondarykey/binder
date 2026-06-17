package settings

import (
	"testing"
)

func TestFlattenJSON(t *testing.T) {
	input := map[string]interface{}{
		"code": "English",
		"go": map[string]interface{}{
			"window": map[string]interface{}{
				"main":    "Binder",
				"history": "Binder - History",
			},
			"error": map[string]interface{}{
				"binderNotOpened": "Binder is not opened",
			},
		},
	}

	out := make(map[string]string)
	flattenJSON("", input, out)

	tests := []struct {
		key  string
		want string
	}{
		{"code", "English"},
		{"go.window.main", "Binder"},
		{"go.window.history", "Binder - History"},
		{"go.error.binderNotOpened", "Binder is not opened"},
	}

	for _, tt := range tests {
		if got := out[tt.key]; got != tt.want {
			t.Errorf("flattenJSON[%q] = %q, want %q", tt.key, got, tt.want)
		}
	}
}

func TestT_Fallback(t *testing.T) {
	i18nMu.Lock()
	i18nMessages = map[string]string{"go.window.main": "Binder"}
	i18nLangCode = "en"
	i18nMu.Unlock()

	if got := T("go.window.main"); got != "Binder" {
		t.Errorf("T(existing) = %q, want %q", got, "Binder")
	}
	if got := T("go.nonexistent.key"); got != "go.nonexistent.key" {
		t.Errorf("T(missing) = %q, want key itself", got)
	}
}

func TestI18nLang(t *testing.T) {
	i18nMu.Lock()
	i18nMessages = map[string]string{}
	i18nLangCode = "en"
	i18nCallbacks = nil
	i18nMu.Unlock()

	if got := I18nLang(); got != "en" {
		t.Errorf("I18nLang() = %q, want %q", got, "en")
	}
}

func TestOnLanguageChange(t *testing.T) {
	i18nMu.Lock()
	i18nCallbacks = nil
	i18nMu.Unlock()

	called := false
	OnLanguageChange(func(code string) {
		called = true
	})

	i18nMu.RLock()
	count := len(i18nCallbacks)
	i18nMu.RUnlock()

	if count != 1 {
		t.Errorf("callback count = %d, want 1", count)
	}
	_ = called
}
