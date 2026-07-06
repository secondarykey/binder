# Binder フロントエンド

## 構成 (src/)

利用スコープに基づいてディレクトリを分割している。

- **main.jsx** — エントリポイント。URLパラメータで App / CommitApp / HistoryApp を切り替え
- **Event.jsx** — コンポーネント間通信用のカスタムイベントバス
- **Message.jsx** — Snackbar通知

**app/** — アプリエントリ & アプリ固有コンポーネント:
- App.jsx — メインウィンドウ: 左側Menu + 右側Content
- HistoryApp.jsx — ファイル履歴用の別ウィンドウ
- Content.jsx — ルートベースのコンテンツ切り替え（react-router）
- Menu.jsx — 左サイドバー（アイコンバー + サブメニュー）
- FileMenu / TemplateTree / HistoryMenu / HistoryPatch — 各ウィンドウ/メニュー固有のコンポーネント

**pages/** — ルーティングされるページ:
- History.jsx / BinderRegister.jsx / BinderRemote.jsx — バインダー管理画面
- editor/ — 分割ペインのMarkdownエディタ（左:編集、右:プレビュー）、marked.jsとMermaid.js使用

**dialogs/** — ダイアログ & dialog内でのみ使用するコンポーネント:
- components/ — ConfirmDialog, MetaDialog, ModalWrapper, ActionButton, DialogError（ダイアログ共通コンポーネント）
- *MetaDialog.jsx — Note/Diagram/Asset/Layer/Templateのメタ編集ダイアログ
- *Modal.jsx — Binder/Commit/Publish/Setting/Branch/Merge/Push のフルスクリーンモーダル
- Binder.jsx / Setting.jsx / GenerateForm.jsx 等 — モーダル内でのみ使用するコンポーネント
- PluginSetting.jsx / RootFileSetting.jsx — バインダー設定のタブ（プラグイン / ルートファイル）
- AppPluginSetting.jsx — アプリ設定のプラグインタブ
- ModifiedMenu.jsx / UnpublishedMenu.jsx — 未記録一覧・未公開一覧

**components/** — 複数スコープで共有されるコンポーネント:
- Tree.jsx — 汎用ツリーコンポーネント（`@mui/x-tree-view`）
- BinderTree.jsx — ノート・ダイアグラム・アセットの階層ツリー（Menu + Editor で使用）
- Commit.jsx / Patch.jsx — コミット関連（CommitApp + CommitModal で使用）
- Note.jsx / Diagram.jsx / AssetViewer.jsx — エンティティ操作コンポーネント
- components/editor/ — `@shared/editor/...` への re-export ラッパー（実体は `_cmd/shared/frontend/`）

**bindings/** — Wails v3が自動生成するJSバインディング（手動編集不可・コミット禁止）

## テーマ・言語の利用

- テーマ: `var(--変数名)` をsx prop / inline style / CSS いずれでも使用可能。切り替えは `applyTheme(themeId)`（`src/theme.js`）。CSS変数の追加はスキル `binder-i18n-theme` を参照
- 言語: `useTranslation` フックで `t("menu.setting")` のように参照。動的読み込みは `loadLanguage(code)`（`src/language.jsx`）。翻訳キー追加はスキル `binder-i18n-theme` を参照
- エラー表示: `src/error.js` の `parseError(err)`。仕組みはスキル `binder-user-error` を参照

## テスト構成

- テストフレームワーク: Vitest（`vitest.config.js`）
- テストファイル: `src/__tests__/*.test.jsx`
- セットアップ: `src/__tests__/setup.js`（`@wailsio/runtime` のグローバルモック、ResizeObserver ポリフィル、i18n 初期化）
- 全コンポーネントにビルドパスレベルのテストあり（2026-07時点: 72ファイル・147テスト）

```bash
# フロントエンドテスト実行
cd _cmd/binder/frontend && npx vitest run

# ビルド確認（Junction 済み前提）
cd _cmd/binder/frontend && ./node_modules/.bin/vite.cmd build
```
