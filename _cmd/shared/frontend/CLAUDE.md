# 共有フロントエンドコンポーネント

Binder と Binder Lite のフロントエンドで共有するエディタコンポーネント群。

## 構成

```
_cmd/shared/frontend/editor/
  EditorArea.jsx       行番号ガター + textarea エディタ
  SearchBar.jsx        テキスト検索フローティングパネル
  HTMLFrame.jsx        ダブルバッファ iframe プレビュー
  FontDialog.jsx       フォント設定ダイアログ
  code-copy.js         プレビュー内コードブロックのコピーボタン付与
  inline-mermaid.js    ```mermaid コードブロックの図としての描画
  pan-zoom.js          SVG（図）の拡大・移動操作
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

## コードブロックのコピーボタン（code-copy.js）

プレビュー（`HTMLFrame`）内の `<pre><code>`（``` で囲んだ部分）にコピーボタンを付与する。
`HTMLFrame` に `onCopyCode` を渡したアプリでのみ有効（現状は Lite のみ。Binder は未使用）。

- `attachCodeCopy(doc, { onCopy, copyLabel, copiedLabel })` — `postProcess` から呼ばれ、
  `<pre>` を `.binderCodeBlock` で包んで `.binderCopyButton` を重ねる。
  `<pre>` 自体に入れると `overflow-x: auto` で横スクロールに追従するためラッパーが要る
- `data-copy-text` 属性を持つ要素にもボタンを付ける（`.binderCopyHost` を付与）。
  Mermaid の図のようにコードが画面から消えるものは、描画側が元ソースをこの属性に
  持たせることでコピー対象にできる（`inline-mermaid.js` / Lite の Mermaid モード）
- コピー処理は onCopy に委譲する（iframe 内で `navigator.clipboard` が使える保証がないため）。
  Lite は Go 側の `CopyToClipboard` を渡す
- ボタンの色は iframe にテーマCSSが無いため、親ドキュメントのCSS変数を実値で注入する
  （`applyCodeCopyStyle`。テーマ変更時は `HTMLFrame` の MutationObserver から再注入）
- ラベルは `copyLabels={{ copy, copied }}` で渡す。参照が変わると
  `refreshCodeCopyLabels` で付与済みボタンに反映される（言語切り替え用）

## ```mermaid の描画（inline-mermaid.js）

Markdown 中の ```mermaid コードブロックを図に置き換える。`HTMLFrame` に `inlineMermaid`
を渡したアプリでのみ有効（現状は Lite のみ。Binder のノートは Go 側が `div.binderSVG` を
出力するためこの経路を通らない）。

- `renderInlineMermaid(doc)` — `pre > code.language-mermaid` を `Mermaid.parse()` に通し、
  成功したものだけ `div.binderMermaid` に差し替える。`mermaid.render` はIDで一時要素を扱うため
  逐次実行する
- 構文エラー（編集途中を含む）はコードブロックのまま残す。図が消えるより書きかけの
  テキストが見える方が状態が分かりやすい
- `data-src-line` は差し替え後の要素へ引き継ぐ（プレビューのスクロール同期）
- 元ソースを `data-copy-text` に持たせ、図になってもコピーできるようにする
- クラスは全画面表示用の `.binderSVG`（`height: 100vh` 指定）と分ける。
  文章中の図が1画面分の高さを占めないようにするため
- 配置スタイルは JS から注入する（プレビューCSSはユーザー編集ファイルが優先されるため、
  そちらに書くと既存ユーザーに反映されない）

`HTMLFrame.postProcess` の実行順は「Mermaid 描画 → コピーボタン付与」。
図に変わらなかったコードブロックにだけコピーボタンが付く。

## 図の拡大・移動（pan-zoom.js）

`attachPanZoom(container, { wheelModifier, hint })` — container 内の SVG に
ホイール拡大縮小・ドラッグ移動・ダブルクリックで初期状態に戻す操作を付ける。

- 拡大はカーソル位置基準（`transform-origin: 0 0` + オフセット補正）。
  倍率は 0.1〜8 倍に収める
- `wheelModifier: true` はホイール拡大に Ctrl/⌘ を要求する。文章中の図で使う
  （そのままだと図の上でページをスクロールできなくなる）
- ボタン（コピーボタン）上での操作はドラッグ・リセットの対象外にする
- 適用先: `div.binderSVG`（Lite の Mermaid モード。修飾キー無し）と
  `div.binderMermaid`（```mermaid 由来。Ctrl 併用）。
  Binder のノート内ダイアグラム（`data-mermaid` からパースするもの）は従来どおり対象外

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
