---
name: binder-i18n-theme
description: >
  Binderのテーマ（外部CSSファイル・CSS変数）と言語（外部JSONファイル・i18n翻訳）の仕組みを提供する。
  CSS変数の追加・変更、ダーク/ライトテーマの編集、翻訳キーの追加、言語ファイル（en.json/ja.json）の編集、
  Go側 i18n（settings.InitI18n / settings.T / SetI18nLanguage / OnLanguageChange）、
  ~/.binder/ への配置の仕組み（installThemes / installLanguages / UpdateDefaults / _default ディレクトリ）を扱う。
  テーマ、CSS変数、翻訳、i18n、言語ファイル、ダークモードといったキーワードが出る作業、
  UI文字列の追加・変更を行う作業では必ずこのSkillを参照すること。
---

# テーマ・言語・i18n

## テーマ（外部CSSファイル）

テーマは `setup/_assets/themes/` にデフォルトCSSファイルとして管理し、Go embedでバイナリに埋め込む。アプリ起動時に `~/.binder/themes/_default/` へ配置される。ユーザーは `~/.binder/themes/` に独自CSSを追加でき、同名ファイルはユーザー側が優先される。

**デフォルトテーマの編集**:
- `setup/_assets/themes/dark.css` — ダークテーマ
- `setup/_assets/themes/light.css` — ライトテーマ（darkの全変数を含むこと）

**CSSファイル形式**:
```css
/* @theme-name: Dark */
:root {
  --bg-app: #050505;
  --text-primary: #f1f1f1;
  ...
}
```
- ファイル名（拡張子除く）= テーマID（`setting.json` の `theme` に保存される値）
- 1行目の `/* @theme-name: ... */` コメントが設定画面での表示名。無ければファイル名を使用
- CSS変数の追加・変更はこのファイルを編集する。CSSやJSXにハードコードしないこと

**フロントエンドでの利用**:
- `var(--変数名)` をsx prop / inline style / CSS いずれでも使用可能
- テーマ切り替えは `applyTheme(themeId)`（`_cmd/binder/frontend/src/theme.js`）でGoからCSS文字列を取得し `<style>` タグに注入
- **対象外**: エディタtextareaのフォント色・背景色（FontDialog設定で上書き）、プレビューiframe内のHTML、Mermaidテーマ

**Go API** (`api/setting.go`):
- `GetThemeList()` — 利用可能なテーマ一覧
- `GetThemeCSS(id)` — 指定テーマのCSS文字列を返す

## 言語（外部JSONファイル）

言語ファイルは `setup/_assets/languages/` にデフォルトJSONファイルとして管理し、Go embedでバイナリに埋め込む。テーマと同じ `_default/` ディレクトリ分離パターンで `~/.binder/languages/` に配置される。

**デフォルト言語ファイルの編集**:
- `setup/_assets/languages/en.json` — 英語
- `setup/_assets/languages/ja.json` — 日本語

**JSONファイル形式**（ネストしたオブジェクト。フロントエンドは `t("menu.binder")` のようにドット記法で参照する）:
```json
{
  "code": "English",
  "menu": {
    "binder": "Binder Tree",
    ...
  }
}
```
- ファイル名（拡張子除く）= 言語コード（`setting.json` の `language` に保存される値）
- `"code"` キーが設定画面での表示名
- 翻訳キーのIDは表示を行うコンポーネントの名称・区分で発行する

**フロントエンドでの利用**:

コンポーネントでは `useTranslation` フックで翻訳テキストを取得する:
```js
import "../language";
import { useTranslation } from 'react-i18next'

const {t} = useTranslation();
t("menu.setting")
```

言語の動的読み込みは `loadLanguage(code)`（`_cmd/binder/frontend/src/language.jsx`）でGoから翻訳JSONを取得し `i18n.addResourceBundle()` で登録する。

**Go API** (`api/shared/shared.go` — Binder/Lite 共通の Shared Service):
- `GetLanguageList()` — 利用可能な言語一覧
- `GetLanguageData(code)` — 指定言語のJSON文字列を返す

## Go側 i18n（`settings` パッケージ内）

Go側で生成するUI文字列（ウィンドウタイトル・ダイアログ・ファイルフィルタ・ユーザー向けエラー）も同じ言語JSONファイルから翻訳する。`settings/languages.go` に実装。

- **`settings.InitI18n(code)`** — 言語JSONを読み込み、ネスト構造を `"go.window.main"` 形式にフラット化して保持。設定ロード後・**ウィンドウ作成前**に `main()` から呼ぶ（Binder/Lite 両方）
- **`settings.T(key)`** — 翻訳文字列を返す。未発見時はキー自体を返す
- **`settings.SetI18nLanguage(code)`** — 実行時の言語切り替え。`api.App.SetLanguage()` / `lite.App.SetLanguage()` から呼ばれる
- **`settings.OnLanguageChange(fn)`** — 言語変更コールバック登録。main.go でウィンドウタイトルの `SetTitle()` 更新に使用（`_cmd/binder/window.go` の `UpdateWindowTitles()` が開いているサブウィンドウを更新）

**翻訳キーの規約**: Go側専用キーは言語JSONの `"go"` セクションに置く（`go.window.*`, `go.dialog.*`, `go.filter.*`, `go.error.*`）。フロントエンドのキーと衝突しない。

**注意**: `fmt.Errorf` / `xerrors.Errorf` に `settings.T()` を渡す場合は非定数フォーマット文字列の vet エラーを避けるため `fmt.Errorf("%s", settings.T(...))` とする。

## 配置の仕組み（テーマ・言語共通）

- `setup/externals.go` の `installThemes()` / `installLanguages()` が `_assets/` から `~/.binder/{themes,languages}/_default/` にコピー
- 初回起動時: ファイルが存在しなければコピー（`force=false`）
- アプリバージョンアップ時・開発モード時: 常に上書き（`setup.UpdateDefaults()` → `force=true`）
- バージョン比較は `setting.json` の `appVersion` フィールドで管理（`setup/setup.go` の `migrateApp()`）
- 優先順位: ユーザーディレクトリ > `_default/`
