# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Binderは技術文書作成向けの実験的なデスクトップMarkdownエディタ。**Wails v3**（Go + React）でフレームレスのデスクトップアプリケーションを構築している。コンテンツはローカルgitリポジトリにファイルとして保存され、メタデータはCSVベースのSQLテーブル（csvq）で管理される。

## ビルド・開発コマンド

### 前提条件
- Go 1.25+
- Node.js + npm
- Wails v3 CLI (`go install github.com/wailsapp/wails/v3/cmd/wails3@latest`)
- Task (`go install github.com/go-task/task/v3/cmd/task@latest`)

### 開発
```bash
# 開発モードで起動（_cmd/binder/ から実行）
cd _cmd/binder && task dev
# または直接
cd _cmd/binder && wails3 dev -config ./build/config.yml
```

### ビルド
```bash
# プロダクションビルド（_cmd/binder/ から実行）
cd _cmd/binder && task build
```

### フロントエンドバインディング生成
```bash
# Wails v3 バインディング再生成（_cmd/binder/ から実行）
cd _cmd/binder && wails3 task common:generate:bindings
```

### DAO コード生成
```bash
# db/model/*.go の構造体からDAOを再生成（リポジトリルートから実行）
go run ./_cmd/gen/main.go
```

### テスト
```bash
# 全Goテスト実行
go test ./...

# パッケージ単位でテスト実行
go test ./fs/...
go test ./db/...

# 単一テスト実行
go test ./fs/ -run TestAssetRead
```

**注意**: `binder` パッケージのテストには既知の失敗がある（`CommitAll` での空コミットエラー）。

## アーキテクチャ

### レイヤー構成

```
Reactフロントエンド (JSX, MUI, Vite)
    ↓ Wails v3 バインディング (frontend/bindings/binder/api/app.js)
api/ — Go APIレイヤー（App構造体をWails v3 Serviceとしてバインドし、JSにメソッドを公開）
    ↓
ルートパッケージ (binder.go, note.go, diagram.go 等) — コアビジネスロジック（Binder構造体）
    ↓
db/  — CSVベースのSQLデータベース（csvq-driver）、DAO
fs/  — Gitバックのファイルシステム（go-git）、ファイルI/O、コミット管理
```

### 主要な型

- **`Binder`** (binder.go) — 中心的なオーケストレータ。FileSystem、DB、HTTPサーバーへの参照を保持。ライフサイクル: `Load()` → 使用 → `Close()`
- **`api.App`** (api/api.go) — Wails v3 の Service として登録される構造体。`Startup()` は Wails の Service ライフサイクルとは独立しており、`main()` から直接呼び出される。フロントエンドからのメソッド呼び出しを受け、`Binder`に委譲
- **`Window`** (_cmd/binder/window.go) — Wails v3 の第2 Service。ウィンドウ操作（サイズ変更・移動・最小化・最大化）を担当
- **`fs.BinderMeta`** (fs/meta.go) — `binder.json` の読み書きを担当。アプリバージョン・name・detail を保持。`Schema` フィールドは後方互換用（非推奨）
- **`fs.FileSystem`** (fs/fs.go) — go-gitリポジトリのラッパー。全コンテンツ変更はここを経由し、gitコミットされる
- **`db.Instance`** (db/db.go) — csvqを使用したCSVファイルへのSQLインターフェース。テーブル: notes, diagrams, assets, templates, structures
- **`internal.Version`** (internal/version.go) — セマンティックバージョンのパース・比較。`NewVersion(buf)`, `Lt()`, `Gt()`, `Eq()` 等

### Wails v3 固有の注意点

- `api.App` は Wails v3 Service として `application.NewService(app)` で登録されるが、`ServiceStartup` インターフェースは実装していない。初期化は `main()` から `app.Startup()` を直接呼ぶ
- アプリ取得: サービス内から `application.Get()` で `*application.App` を取得
- ウィンドウ作成: `app.Window.NewWithOptions(opts)`
- ダイアログ: `app.Dialog.OpenFile().CanChooseDirectories(true).PromptForSingleSelection()`
- ブラウザ: `app.Browser.OpenURL(url)`
- フロントエンドバインディング: `frontend/bindings/binder/api/app.js`（Goパッケージパスに対応、手動編集不可）
- ビルド設定: `_cmd/binder/Taskfile.yml` + `_cmd/binder/build/config.yml`（Wails v2の `wails.json` はメタデータのみ残存）
- バージョン: `_cmd/binder/main.go` が `build/config.yml` に埋め込まれた `version: "x.y.z"` を `parseVersion()` で取得

### データフロー

全ての変更操作（ノート・ダイアグラム・アセットの作成/編集/削除）は以下のパターンに従う:
1. フロントエンドがWailsバインディング経由で`api.App`のメソッドを呼び出す
2. `api.App`が`Binder`のビジネスロジックに委譲する
3. `Binder`が`fs`でファイルシステムに書き込み、`db`でメタデータを更新する
4. `fs`が変更をgitコミットする
5. JSONレスポンスをフロントエンドに返す

### フロントエンド構成 (_cmd/binder/frontend/src/)

- **App.jsx** — ルートレイアウト: 左側Menu + 右側Content
- **Content.jsx** — ルートベースのコンテンツ切り替え（react-router）
- **BinderModal.jsx** — バインダー選択モーダル
- **CommitApp.jsx / CommitModal.jsx** — git コミット操作UI
- **components/Tree.jsx** — 汎用ツリーコンポーネント
- **Event.jsx** — コンポーネント間通信用のカスタムイベントバス
- **contents/Editor/** — 分割ペインのMarkdownエディタ（左:編集、右:プレビュー）、marked.jsとMermaid.js使用
- **contents/LeftMenu/** — `@mui/x-tree-view` の `SimpleTreeView` を使ったノート・ダイアグラムのツリー表示
- **contents/Binder.jsx / BinderRegister.jsx / BinderRemote.jsx** — バインダー管理UI
- **contents/Assets.jsx / AssetViewer.jsx** — アセット一覧・表示
- **bindings/binder/api/app.js** — Wails v3が自動生成するJSバインディング（手動編集不可）

### ドメインエンティティと構造 (db/model/)

スキーマ 0.2.0 から `structures` テーブルで階層構造を一元管理している。

- **Structure** — 全エンティティの共通階層情報: `id, parent_id, seq, type, name, detail, alias, publish_date, republish_date`。`publish_date/republish_date` は 0.4.7 でここに集約
- **Note** — Markdownコンテンツ: `id, layout_template, content_template`
- **Diagram** — Mermaidダイアグラム: `id`
- **Asset** — 添付バイナリ/テキストファイル: `id, binary`
- **Template** — 公開用HTMLレイアウト/コンテンツテンプレート: `id, type, name, detail, seq`

Note/Diagram/Asset は `ApplyStructure(s *json.Structure)` で Structure の情報（parent_id, name, detail, alias）を取り込む。

### データベース (db/)

csvq（CSVファイルに対するSQL）を使用。binderリポジトリ内の`db/`ディレクトリにCSVテーブルファイルを格納。

**スキーマバージョン管理**:
- `binder.json`（バインダールートに配置）: `{"version": "x.y.z", "name": "...", "detail": "..."}` でアプリバージョン・バインダー情報を管理（0.4.5以降 `config.csv` は廃止）
- 旧形式（`db/schema.version`）は自動マイグレーション後に削除される

**スキーママイグレーション**:

DBマイグレーション (`db/convert/`):
- `010/converter.go` — 0.1.0への移行（assets に binary カラム追加）
- `020/converter.go` — 0.2.0への移行（structures テーブル追加、parent_id/name/detail を各エンティティから分離）
- `021/converter.go` — 0.2.1への移行（alias を各エンティティから structures に移動）
- `022/converter.go` — 0.2.2への移行（CSVは変更なし、FSマイグレーションのみ）
- `033/converter.go` — 0.3.3への移行（スニペットタイプ削除、テンプレートタイプ名変更）
- `034/converter.go` — 0.3.4への移行（templates に seq カラム追加）
- `045/converter.go` — 0.4.5への移行（config.csv を削除、binder.json へ移行）
- `047/converter.go` — 0.4.7への移行（publish_date/republish_date を structures に集約、notes/diagrams から削除）
- `048/converter.go` — 0.4.8への移行（CSVは変更なし、FSマイグレーションのみ）
- `core/core.go` — コンバーターフレームワーク（`Converter` 型、`FileSet` 追跡）
- `convert.go` — DBコンバーターのオーケストレーション

FSマイグレーション (`fs/convert/`):
- `migrate.go` — マイグレーション振り分け
- `convert047.go` — `MigrateV047()`: `docs/` ディレクトリを削除
- `convert048.go` — `MigrateV048()`: `assets/{noteId}-meta` → `assets/meta/{noteId}` にリネーム

バインダーレベルマイグレーション (`convert/`):
- `convert.go` — マイグレーション全体を調整（DB + FS を順次実行、binder.json を更新してコミット）
- `meta.go` — `binder.json` の読み込み（`db/schema.version` へのフォールバック付き）
- `config.go` — 0.4.5 移行用: `config.csv` 読み込みと CSV エスケープ解除

**DAO コード生成**:
- `_cmd/gen/main.go` が `db/model/*.go` の構造体タグ（`db:"col_name"`, `db:"id:key"`, `db:"col:insert"`）を読んで `db/*_dao.go` を生成
- モデルを変更したら `go run ./_cmd/gen/main.go` で再生成すること

### 設定

ユーザー設定はホームディレクトリの`binder/setting.json`に保存（ウィンドウ位置、git設定、外観）。`settings/`パッケージで管理。

## コーディング規約

- エラーラッピングは`golang.org/x/xerrors`を使用（`xerrors.Errorf("context: %w", err)`）
- ロギングは`log/slog`と`log/`パッケージのヘルパーを使用（`log.PrintTrace()`, `log.PrintStackTrace()`）
- IDはUUID v7（`github.com/google/uuid`）
- Wailsアプリのエントリーポイントは`_cmd/binder/`（アンダースコアプレフィックスに注意）
- コードベース全体に日本語コメントあり
- コミットメッセージはConventional Commits形式（`fix:`, `feat:`, `docs:`）
- `api/json/`パッケージはAPI向けのモデル型を含み、`db/model/`とは別
- DAOファイルは`_dao.go`サフィックスを使用（自動生成、手動編集不可）
- `fs`パッケージはOSファイルシステムとインメモリファイルシステム（billy）の両方をサポート（テスト用）
- セマンティックバージョン操作は`internal.Version`を使用（直接文字列比較は不可）

## バージョン

指示のあった数値で以下を編集

- _cmd/binder/build/config.yml info.version
- _cmd/binder/frontend/package.json version

