---
name: binder-plugin-rootfile
description: >
  Binderのプラグイン機能（marked.js 拡張）とルートファイル機能（README.md 等）の仕様・実装マップを提供する。
  プラグインのディレクトリ構造・JSファイル形式・読み込み順・アプリレベルプラグイン、
  ルートファイルの予約名・コミットフロー（即コミットしない）・fs/api実装を扱う。
  プラグイン、marked拡張、plugins/、ルートファイル、README、RootFile、PluginSetting
  といったキーワードが出る作業では必ずこのSkillを参照すること。
---

# プラグイン & ルートファイル

## プラグイン（marked.js 拡張）

ユーザーが配置した JS ファイルを `marked.use()` に渡してマークダウンレンダリングを拡張する仕組み。

**ディレクトリ構造**:
```
plugins/              ← バインダー内（git管理・共有される）
  marked/
    github-alerts.js  ← ユーザーが配置するプラグイン
  mermaid/            ← 将来用（未実装）

~/.binder/plugins/    ← アプリレベル（全バインダー共通）
  _default/
    marked/
      example.js      ← テンプレート（参考用）
  marked/             ← ユーザーが登録したアプリプラグイン
    github-alerts.js
```

**プラグイン JS ファイル形式**（IIFE で `marked.use()` 互換オブジェクトを返す）:
```js
/* @plugin-name: GitHub Alerts */
(function() {
  return {
    extensions: [{ name, level, start, tokenizer, renderer }],
    renderer: { blockquote(token) { ... } },
    hooks: { preprocess(md) { ... } },
    walkTokens(token) { ... }
  };
})();
```

**読み込み順**: ファイル名アルファベット順。`01-alerts.js`, `02-footnotes.js` のようにプレフィックスで制御可能。

**Go 実装**:
- `fs/plugin.go` — `ReadPlugins(engine)`, `ListPlugins(engine)`, `WritePlugin`, `DeletePlugin`, `RenamePlugin`
- `fs/path.go` — `PluginDir = "plugins"`, `PluginEngineDir(engine)`
- `binder.go` — `GetPlugins`, `ListPlugins`, `SavePlugin`, `RemovePlugin`, `RenamePlugin`, `InstallAppPlugin`
- `api/plugin.go` — バインダープラグイン CRUD の Wails バインディング
- `api/app_plugin.go` — アプリプラグイン CRUD + `InstallAppPlugin`
- `settings/plugins.go` — `~/.binder/plugins/` のパスヘルパー・CRUD（OS レベル、git 管理外）。
  `ListAppPlugins` は設定画面がメタデータを解析できるよう `AppPluginInfo.Content` を含めて返す
- `setup/externals.go` — `installPlugins()` でテンプレートを `_default/` に配置

**フロントエンド実装**:
- `_cmd/shared/frontend/editor/engines/Marked.jsx` — `applyPlugins(plugins)`: `(0, eval)(content)` で評価し `marked.use()` に渡す
- `_cmd/binder/frontend/src/main.jsx` — `Marked.init` オーバーライド内で `GetPlugins("marked")` を呼びプラグインを適用
- `_cmd/shared/frontend/editor/pluginMeta.js` — `@plugin-name` / `@plugin-version` / `@marked` の
  パースと互換判定（`parsePluginMeta` / `satisfiesRange` / `pluginCompatStatus`）。
  メタデータの解釈は **JS 側に一元化**しており Go 側では行わない
- `dialogs/components/PluginMeta.jsx` — 設定画面で共有するメタデータ表示部品
  （`PluginMetaLine` = 表示名 / バージョン / 対応marked、`MarkedVersionLine` = 現在の marked、
  `STATUS_COLOR` / `SECONDARY_LABEL`）
- `dialogs/PluginSetting.jsx` — バインダー設定のプラグインタブ（CRUD + アプリプラグインからのインストール）。
  状態ドット + メタ行を表示。判定は宣言（`@marked`）・検証記録・実行結果（`Marked.getPluginStatus()`）の重ね合わせ
- `dialogs/AppPluginSetting.jsx` — アプリ設定のプラグインタブ（CRUD）。
  アプリ階層は実行時に適用されないため、判定は宣言（`@marked`）のみ

**即時反映**: プラグインの追加・更新・削除後に `Marked.reset()` を呼ぶことで、次回プレビュー描画時に marked を再初期化してプラグインを再適用する。

**サンプルプラグイン**: `setup/_assets/plugins/marked/github-alerts.js` — GitHub Note 記法（`> [!NOTE]` 等）のサンプル実装（配布対象外・動作確認用）。

## ルートファイル（README.md 等）

バインダールート直下にユーザーが任意の名前のファイル（README.md, LICENSE 等）を配置・編集できる仕組み。DBには登録せず、ファイルシステムのみで管理する。

**他エンティティとの違い**:
- ファイル名はユーザーが決定（ID規約・structures テーブルの対象外）
- 保存・削除・リネームは**即コミットしない**。変更は未記録一覧に「File」セクションとして表示され、既存の記録フローでコミットする（プラグインは即コミットなので注意）

**予約名**: `binder.json`, `.gitignore`, `user_data.enc`, 各管理ディレクトリ名（`notes`, `diagrams`, `assets`, `layers`, `templates`, `plugins`, `db`, `docs`）は使用不可。Windows対応のため大文字小文字を区別せず比較する（`fs.ValidateRootFileName`）。先頭ドットのファイル名も不可。

**Go 実装**:
- `fs/rootfile.go` — `ListRootFiles`, `ReadRootFile`, `WriteRootFile`, `DeleteRootFile`, `RenameRootFile`, `ValidateRootFileName`
- `fs/git.go` — `getModelType()` がルート直下のユーザーファイルを `"file"` タイプとして分類（予約ファイルは管理外のまま）。`ModifiedFiles.Files()` フィルタ
- `tree.go` — `GetModifiedTree()` の `DIR_File` カテゴリ。表示名はファイル名そのもの（DBルックアップなし）
- `git.go` — `ToFile()` / `getFilename()` の `"file"` ケース（id = ファイル名）。これにより未記録一覧からのコミット・差分表示（`GetNowPatch`）・履歴・復元が既存の仕組みで動く
- `binder.go` / `api/rootfile.go` — CRUD の委譲と Wails バインディング

**フロントエンド実装**:
- `dialogs/RootFileSetting.jsx` — バインダー設定の「ファイル」タブ。一覧 + 追加・リネーム・削除。編集ダイアログは `.md` / `.markdown` でプレビュー切替（`Marked.parse()` 使用）
- `dialogs/ModifiedMenu.jsx` — `DIR_File` を「File」セクションとして表示。`type === 'file'` はエディタ画面を持たないためダブルクリックで開かない
