package shared

import (
	"binder/settings"
)

// Shared は Binder / Lite 共通の Wails v3 Service。
// 設定ファイルに依存しないリソース読み取り系メソッドを提供する。
type Shared struct{}

func New() *Shared {
	return &Shared{}
}

// --- フォント ---

// GetFontNames はシステムにインストールされたフォント名の一覧を返す。
func (s *Shared) GetFontNames() ([]string, error) {
	return settings.FontNames(), nil
}

// --- テーマリソース ---

// GetThemeList は利用可能なテーマ一覧を返す。
func (s *Shared) GetThemeList() ([]settings.ThemeInfo, error) {
	return settings.ListThemes()
}

// GetThemeCSS は指定IDのテーマCSSを返す。
func (s *Shared) GetThemeCSS(id string) (string, error) {
	return settings.ReadThemeCSS(id)
}

// --- 言語リソース ---

// GetLanguageList は利用可能な言語一覧を返す。
func (s *Shared) GetLanguageList() ([]settings.LanguageInfo, error) {
	return settings.ListLanguages()
}

// GetLanguageData は指定コードの言語JSONを返す。
func (s *Shared) GetLanguageData(code string) (string, error) {
	return settings.ReadLanguageJSON(code)
}

// ライセンス文はここでは返さない。フロントがルートの LICENSE / THIRD_PARTY_LICENSES を
// ビルド時に取り込む（_cmd/shared/frontend/licenses.js）。Go で埋め込むにはルートパッケージ
// （binder）を import する必要があり、Lite まで db / fs を抱え込むため。
// このパッケージは Lite からも使うので、binder（ルート）・db・fs を import しない。
