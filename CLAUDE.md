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

**注意**: `binder` パッケージのテストには既知の失敗がある（`CommitAll` での空コミットエラー）。これは今回の変更とは無関係の既存の問題。

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
- **`BinderMeta`** (binder_meta.go) — `binder.json` の読み書きを担当。アプリバージョンとスキーマバージョンを保持。`loadMeta()` は旧形式（`db/schema.version`）からの後方互換読み込みもサポート
- **`api.App`** (api/api.go) — Wails v3 の Service として登録される構造体。`ServiceStartup()` で起動時処理、`Terminate()` で終了処理を行う。フロントエンドからのメソッド呼び出しを受け、`Binder`に委譲
- **`fs.FileSystem`** (fs/fs.go) — go-gitリポジトリのラッパー。全コンテンツ変更はここを経由し、gitコミットされる
- **`db.Instance`** (db/db.go) — csvqを使用したCSVファイルへのSQLインターフェース。テーブル: notes, diagrams, assets, templates, config, structures

### Wails v3 固有の注意点

- `api.App` は `ServiceStartup(ctx context.Context, options application.ServiceOptions) error` を実装（v2の `Startup(ctx)` とは異なる）
- アプリ取得: サービス内から `application.Get()` で `*application.App` を取得
- ウィンドウ作成: `app.Window.NewWithOptions(opts)`
- ダイアログ: `app.Dialog.OpenFile().CanChooseDirectories(true).PromptForSingleSelection()`
- ブラウザ: `app.Browser.OpenURL(url)`
- フロントエンドバインディング: `frontend/bindings/binder/api/app.js`（Goパッケージパスに対応、手動編集不可）
- ビルド設定: `_cmd/binder/Taskfile.yml` + `_cmd/binder/build/config.yml`（Wails v2の `wails.json` はバージョン情報のみ残存）

### データフロー

全ての変更操作（ノート・ダイアグラム・アセットの作成/編集/削除）は以下のパターンに従う:
1. フロントエンドがWailsバインディング経由で`api.App`のメソッドを呼び出す
2. `api.App`が`Binder`のビジネスロジックに委譲する
3. `Binder`が`fs`でファイルシステムに書き込み、`db`でメタデータを更新する
4. `fs`が変更をgitコミットする
5. JSONレスポンスをフロントエンドに返す

### フロントエンド構成 (_cmd/binder/frontend/src/)

- **App.jsx** — ルートレイアウト: 左側Menu + 右側Content
- **Menu.jsx** — サイドバーナビゲーション
- **Content.jsx** — ルートベースのコンテンツ切り替え（react-router）
- **Event.jsx** — コンポーネント間通信用のカスタムイベントバス
- **contents/Editor/** — 分割ペインのMarkdownエディタ（左:編集、右:プレビュー）、marked.jsとMermaid.js使用
- **contents/LeftMenu/** — `@mui/x-tree-view` の `SimpleTreeView` を使ったノート・ダイアグラムのツリー表示
- **bindings/binder/api/app.js** — Wails v3が自動生成するJSバインディング（手動編集不可）

### ドメインエンティティと構造 (db/model/)

スキーマ 0.2.0 から `structures` テーブルで階層構造を一元管理している。

- **Structure** — 全エンティティの共通階層情報: `id, parent_id, seq, type, name, detail, alias`。0.2.1でaliasをここに集約
- **Note** — Markdownコンテンツ: `id, layout_template, content_template, publish_date`
- **Diagram** — Mermaidダイアグラム: `id, publish_date`
- **Asset** — 添付バイナリ/テキストファイル: `id, binary`
- **Template** — 公開用HTMLレイアウト/コンテンツテンプレート: `id, type, name, detail`
- **Config** — アプリケーション設定

Note/Diagram/Asset は `ApplyStructure(s *json.Structure)` で Structure の情報（parent_id, name, detail, alias）を取り込む。

### データベース (db/)

csvq（CSVファイルに対するSQL）を使用。binderリポジトリ内の`db/`ディレクトリにCSVテーブルファイルを格納。

**スキーマバージョン管理**:
- `binder.json`（バインダールートに配置）: `{"version": "x.y.z", "schema": "x.y.z"}` でアプリ・スキーマバージョンを管理
- 旧形式（`db/schema.version`）は自動マイグレーション後に削除される

**スキーママイグレーション** (`db/convert/`):
- `010/converter.go` — 0.1.0への移行
- `020/converter.go` — 0.2.0への移行（structures テーブル追加、parent_id/name/detail を各エンティティから分離）
- `021/converter.go` — 0.2.1への移行（alias を各エンティティから structures に移動）
- `convert.go` — バージョン比較で適用すべきコンバーターを選択し順次実行

**DAO コード生成**:
- `_cmd/gen/main.go` が `db/model/*.go` の構造体タグ（`db:"col_name"`, `db:"id:key"`, `db:"col:insert"`）を読んで `db/*_dao.go` を生成
- モデルを変更したら `go run ./_cmd/gen/main.go` で再生成すること

### 設定

ユーザー設定はホームディレクトリの`.binder.json`に保存（ウィンドウ位置、git設定、外観）。`settings/`パッケージで管理。

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
