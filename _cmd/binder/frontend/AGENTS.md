# Binder フロントエンド

## 構成 (src/)

利用スコープに基づいてディレクトリを分割している。

- **main.jsx** — エントリポイント。URLパラメータ（`history` / `overallHistory` / `preview` / `syslog` / `search`）で開くアプリを切り替え、未指定ならメインウィンドウの App
- **Event.jsx** — コンポーネント間通信用のカスタムイベントバス
- **Message.jsx** — Snackbar通知。メッセージに `action: { label, onClick }` を持たせると右端にボタンを出す（例: Doctor の修復通知の「履歴」）

**app/** — アプリエントリ & アプリ固有コンポーネント:
- App.jsx — メインウィンドウ: 左側Menu + 右側Content。各モーダルの開閉状態もここが持つ
- Content.jsx — ルートベースのコンテンツ切り替え（react-router）。`/`＝バインダー一覧、`/file/*`＝バインダー登録、`/editor/:mode/:id`＝エディタ
- Menu.jsx — 左サイドバー（アイコンバー + サブメニュー）
- HistoryApp / PreviewApp / SyslogApp / SearchApp — 別ウィンドウのエントリ
- OverallHistoryApp.jsx — 全体履歴の別ウィンドウ（バインダー未オープンでも `binderPath` 指定で開ける）
- BranchHistoryModal.jsx — 全体履歴のアプリ内モーダル版（左メニューの「履歴」から開く）
- OverallHistoryMenu / OverallHistoryDetail / OverallHistoryRight — 全体履歴の左ペイン（コミット一覧）・コミット詳細・右ペイン。右ペインは上記2つのホストで共用する
- FileMenu / TemplateTree / HistoryMenu / HistoryPatch — 各ウィンドウ/メニュー固有のコンポーネント

**dialogs/** — ダイアログ & dialog内でのみ使用するコンポーネント:
- components/ — ConfirmDialog, MetaDialog, ModalWrapper, ActionButton, DialogError（ダイアログ共通コンポーネント）
- *MetaDialog.jsx — Note/Diagram/Asset/Layer/Templateのメタ編集ダイアログ
- rootAsset.js / errorPage.js — Asset/NoteMetaDialog の判定（サイトのルートに置くアセット・404 ページの alias と警告）。`_docs/site-root-files.md`
- BinderModal / CommitModal / PublishModal / SettingModal — フルスクリーンモーダル
- BranchModal.jsx — `BranchPanel` の名前付きエクスポートのみ（モーダル本体は無く、全体履歴の右ペインで使う）
- Binder.jsx / Setting.jsx / GenerateForm.jsx 等 — モーダル内でのみ使用するコンポーネント
- ImportPanel.jsx — 取り込み（他ブランチ / リモートから）。全体履歴の右ペインのタブ
- SendForm.jsx — 送信（全体 / docs のみ）。PublishModal の右ペインのタブ
- RemoteSetting.jsx — リモートの一覧・追加・編集・削除ダイアログ
- PluginSetting.jsx / RootFileSetting.jsx — バインダー設定のタブ（プラグイン / ルートファイル）
- AppPluginSetting.jsx — アプリ設定のプラグインタブ
- ModifiedMenu.jsx / UnpublishedMenu.jsx — 未記録一覧・未公開一覧
- PublishRefsDialog.jsx — ノートの公開時に、まだ公開していない参照先（図・アセット・レイヤー）を一緒に公開するかを選ぶダイアログ（`usePublishRefsDialog` で Promise として使う）。公開する 1 件の描画は `src/publish-items.js`（`_docs/publish-design.md`）

**components/** — 複数スコープで共有されるコンポーネント:
- Tree.jsx — 汎用ツリーコンポーネント（`@mui/x-tree-view`）
- BinderTree.jsx — ノート・ダイアグラム・アセットの階層ツリー（Menu + Editor で使用）
- Commit.jsx / CommitBar.jsx / Patch.jsx — 記録関連（CommitModal + エディタで使用）
- BinderHistory / BinderRegister / BinderRemote — バインダー管理画面（Content からルーティング）
- AssetViewer.jsx / LayerEditor.jsx — アセット表示・レイヤー編集
- AuthFields.jsx / AuthAccordion.jsx / RemoteSelect.jsx — リモート接続まわりの共通部品（ImportPanel / SendForm / Binder.jsx で共用）
- components/editor/ — エディタ画面（`/editor/:mode/:id`）
  - **Component.jsx** — エディタ本体。開く・変換してプレビューする・保存する・公開する、の状態と流れを持つ（約 2100 行）。
    ここに残しているのは互いに絡む状態（`text` / `parseStatus` / 各種 ref）で、**動かして確かめずに分けない**
  - 画面の部品（状態はメニューの開閉だけ。何をするかは本体から受け取る）:
    `EditorToolbar.jsx`（編集側のツールバー）/ `ToolbarMenus.jsx`（アウトライン・スニペット・ID 挿入・囲み・その他メニュー。
    Ctrl+Shift+O と Ctrl+T もここ）/ `PreviewToolbar.jsx`（プレビュー側）/ `ParseStatusBar.jsx`（ステータスバーとエラー・警告のダイアログ）/ `IdStatusBar.jsx`
  - フック: `useEditorCandidates.js`（オートコンプリートの候補）/ `useSplitterDrag.js`（スプリッターのドラッグ）
  - 状態を持たない関数: `tree-flatten.js` / `table-markdown.js` / `conflict-view.js` / `editor-history.js`（閲覧履歴。App.jsx も使う）/
    `preview-run.js` / `editor-save.js`（保存のデバウンス）/ `download.js` / `diagram-pan-zoom.js` / `id-insert.js` / `binder-link.js` / `external-editor.js`
  - `EditorArea.jsx` / `SearchBar.jsx` / `HTMLFrame.jsx` / `Autocomplete.jsx` / `engines/` — `@shared/editor/...` への re-export ラッパー（実体は `_cmd/shared/frontend/`）
  - 部品やフックで種類を見るときは `Mode`（App.jsx）を import せず、`isNote` などを props で受ける（App.jsx との循環を増やさない。テストも軽くなる）

**bindings/** — Wails v3が自動生成するJSバインディング（手動編集不可・コミット禁止）

## テーマ・言語の利用

- テーマ: `var(--変数名)` をsx prop / inline style / CSS いずれでも使用可能。切り替えは `applyTheme(themeId)`（`src/theme.js`）。CSS変数の追加は `_docs/skills/binder-i18n-theme/SKILL.md` を参照
- 言語: `useTranslation` フックで `t("menu.setting")` のように参照。動的読み込みは `loadLanguage(code)`（`src/language.jsx`）。翻訳キー追加は `_docs/skills/binder-i18n-theme/SKILL.md` を参照
- エラー表示: `src/error.js` の `parseError(err)`。仕組みは `_docs/skills/binder-user-error/SKILL.md` を参照

## テスト構成

- テストフレームワーク: Vitest（`vitest.config.js`）
- テストファイル: `src/__tests__/*.test.jsx`
- セットアップ: `src/__tests__/setup.js`（`@wailsio/runtime` のグローバルモック、ResizeObserver ポリフィル、i18n 初期化）
- 全コンポーネントにビルドパスレベルのテストあり（2026-11時点: 102ファイル・490テスト）

```bash
# フロントエンドテスト実行
cd _cmd/binder/frontend && npx vitest run

# ビルド確認（Junction 済み前提）
cd _cmd/binder/frontend && ./node_modules/.bin/vite.cmd build
```
