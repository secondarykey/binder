# 共有フロントエンドコンポーネント

Binder と Binder Lite のフロントエンドで共有するエディタコンポーネント群。

## 構成

```
_cmd/shared/frontend/editor/
  EditorArea.jsx       行番号ガター + textarea エディタ
  SearchBar.jsx        テキスト検索フローティングパネル
  HTMLFrame.jsx        ダブルバッファ iframe プレビュー
  FontDialog.jsx       フォント設定ダイアログ
  markdown-keys.js     Markdown 入力支援（リスト継続・引用継続等）
  useAutocomplete.js   汎用オートコンプリートフック
  mermaid-candidates.js Mermaidオートコンプリートのデータ定義
  engines/
    Scripter.jsx       ESM/UMD 動的読み込みユーティリティ
    Marked.jsx         marked.js ラッパー
    Mermaid.jsx        mermaid.js ラッパー
```

## 参照方式

- **Binder**: 既存の `components/editor/` に re-export ラッパーを配置（`export { default } from "@shared/editor/..."` の1行）。既存コードの import パスを維持
- **Lite**: `@shared/editor/...` を直接 import（旧 `components/editor/` は削除済み）

## Vite 設定

両プロジェクトの `vite.config.js` で以下を設定:
- `resolve.alias`: `@shared` → `_cmd/shared/frontend/` ディレクトリ
- `resolveSharedDeps` プラグイン: shared/ 内の bare import（react, @mui 等）を各プロジェクトの `node_modules` で解決
- `server.fs.allow`: dev server が shared ディレクトリにアクセスすることを許可

## Marked/Mermaid エンジンの初期化

vendor JS の URL はプロジェクトごとに異なるため、`setVendorUrl()` で外部から注入する:
```js
// 各プロジェクトの main.jsx で設定
import Marked from '@shared/editor/engines/Marked'
import markedVendorUrl from './assets/vendor/marked.min.js?url'
Marked.setVendorUrl(markedVendorUrl)
```
Binder は追加で CDN 対応の `init()` を main.jsx で上書きする。

## オートコンプリート

エディタの入力補助機能。Goテンプレート編集とMermaidダイアグラム編集で異なる候補を提供する。

**設定（5つの個別トグル）**:
- `AutoCompleteConfig` (`settings/settings.go`) — `template`, `idAssist`, `autoClose`, `funcHint`, `mermaid` の5フラグ
- 旧形式（`autoComplete: true/false`）との後方互換: Go側は `Editor.UnmarshalJSON` でbool→オブジェクトに変換、フロントエンド側は `typeof e.autoComplete === 'object'` で判定
- 設定UI: `dialogs/EditorSetting.jsx` の5つの小型Switch

**共有フック・データファイル** (`_cmd/shared/frontend/editor/`):
- `useAutocomplete.js` — 汎用オートコンプリートフック。2種類のトリガーをサポート:
  - **文字列トリガー**: `{ trigger: '{{', candidates }` — 特定文字列の入力で発火（Goテンプレート用）
  - **行頭トリガー**: `{ trigger: '', lineStart: true, candidates }` — 行頭からの入力全体でフィルタ（Mermaid用）
- `mermaid-candidates.js` — Mermaidオートコンプリートのデータ定義。`buildMermaidCandidates(types, t)`, `buildMermaidSyntaxMap(t)`, `buildMermaidDirections(t)` をエクスポート
- 候補関数が `{ items, filterKey }` を返すと、`filterKey` でサブトークン置換を行う（例: `flowchart L` → `LR` のみ置換）

**Goテンプレート補完** (`Component.jsx`):
- `{{` トリガー: キーワード・制御構文・アクション・比較・カスタム関数の候補
- `.` トリガー: ドット記法のプロパティ候補
- `"` トリガー: ID補助。`goTemplateCandidates` の `args[argIndex].idType` で厳密に位置判定し、該当引数のみでID一覧を表示。`needsEnd` 付きブロックキーワード（`range` 等）の内側関数も検出
- `autoClose`: `if`/`range`/`with`/`block` 選択時に `{{end}}` を自動挿入
- `funcHint`: カーソル位置の関数に応じて引数ヒントを表示

**Mermaid補完** (`Component.jsx` の `getMermaidCandidates`):
- 1行目: ダイアグラムタイプ候補。ハイブリッド方式（`mermaidKnownKeywords` + `mermaid.getRegisteredDiagramsMetadata()` で動的取得し、`detectType()` で検証）
- 1行目の2語目以降: `flowchart`/`graph` 等の方向指定キーワード候補（TD, LR 等）
- 2行目以降: ダイアグラムタイプ別の構文キーワード候補（`participant`, `subgraph`, `section` 等）
- i18nキー: `autocomplete.mermaid.*`（ダイアグラムタイプ）, `autocomplete.mermaid.dir.*`（方向）, `autocomplete.mermaid.syn.*`（構文）
