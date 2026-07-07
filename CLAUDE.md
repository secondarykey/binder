# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Binderは技術文書作成向けの実験的なデスクトップMarkdownエディタ。**Wails v3**（Go + React）でデスクトップアプリケーションを構築している。コンテンツはローカルgitリポジトリにファイルとして保存され、メタデータはCSVベースのSQLテーブル（csvq）で管理される。

同一リポジトリに軽量版の **Binder Lite**（git管理・DBなしの単体Markdown/Mermaidエディタ、`_cmd/lite/`）も含む。

## 詳細ドキュメントの場所

このファイルには全体像と必須ルールのみを置く。詳細は以下を参照する（ネストした CLAUDE.md は該当ディレクトリのファイルを扱う際に自動で読み込まれるが、計画段階では能動的に Read してよい）。

| トピック | 参照先 |
|---|---|
| DB・ドメインエンティティ・マイグレーション・DAO生成 | `db/CLAUDE.md` |
| fsパッケージ（パス規約・コミット/署名・Status・マージ） | `fs/CLAUDE.md` |
| apiパッケージ（メソッド規約・ファイル別責務） | `api/CLAUDE.md` |
| バインダーレベルマイグレーションの追加方法・各バージョンの移行内容 | `setup/convert/CLAUDE.md` |
| Binderフロントエンド構成・テスト構成 | `_cmd/binder/frontend/CLAUDE.md` |
| Binder Lite（アーキテクチャ・機能・タブ構造） | `_cmd/lite/CLAUDE.md` |
| 共有エディタコンポーネント・オートコンプリート | `_cmd/shared/frontend/CLAUDE.md` |
| ユーザ向けエラー（MessageError / userError / parseError） | Skill: `binder-user-error` |
| テーマ・言語・i18n（CSS変数・翻訳キー・settings.T） | Skill: `binder-i18n-theme` |
| バージョン変更手順 | Skill: `binder-version-up` |
| プラグイン（marked拡張）・ルートファイル（README等） | Skill: `binder-plugin-rootfile` |
| Wails v3 一般（セットアップ・移行・ログ・Bindings） | Skill: `wails3` |

## ビルド・開発コマンド

### 前提条件
- Go 1.25+
- Node.js + npm
- Wails v3 CLI (`go install github.com/wailsapp/wails/v3/cmd/wails3@latest`)
- Task (`go install github.com/go-task/task/v3/cmd/task@latest`)

### 開発・ビルド
```bash
# 開発モードで起動（_cmd/binder/ から実行。Lite は _cmd/lite/ から同じコマンド）
cd _cmd/binder && task dev

# プロダクションビルド
cd _cmd/binder && task build

# Wails v3 フロントエンドバインディング再生成
cd _cmd/binder && wails3 task common:generate:bindings

# DAO再生成（db/model/*.go 変更時、リポジトリルートから実行）
go run ./_cmd/gen/main.go

# バージョン変更（詳細・注意点は Skill: binder-version-up）
go run ./_cmd/version.go 0.0.0
```

### テスト
```bash
# 全Goテスト実行
go test ./...

# パッケージ単位・単一テスト
go test ./fs/...
go test ./fs/ -run TestAssetRead

# フロントエンドテスト実行
cd _cmd/binder/frontend && npx vitest run
```

**テスト実行は必須**: Go・フロントエンドいずれの変更でも、コミット前に関連テストを実行してパスを確認すること。全テストがパスする状態を維持する。テストが壊れたまま放置しない。

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
- **`api.App`** (api/api.go) — Wails v3 の Service として登録される構造体。初期化（`Setup()`）は Wails の Service ライフサイクルとは独立しており、`main()` から直接呼び出される。フロントエンドからのメソッド呼び出しを受け、`Binder`に委譲
- **`Window`** (_cmd/binder/window.go) — Wails v3 の第2 Service。ウィンドウ操作（サイズ変更・移動・最小化・最大化）を担当
- **`shared.Shared`** (api/shared/shared.go) — Binder/Lite 共通の第3 Service。テーマ・言語・フォント一覧の取得
- **`fs.FileSystem`** (fs/fs.go) — go-gitリポジトリのラッパー。全コンテンツ変更はここを経由し、gitコミットされる
- **`fs.BinderMeta`** (fs/meta.go) — `binder.json` の読み書きを担当。アプリバージョン・name・detail を保持。`Schema` フィールドは後方互換用（非推奨）
- **`db.Instance`** (db/db.go) — csvqを使用したCSVファイルへのSQLインターフェース。テーブル: notes, diagrams, assets, templates, structures
- **`internal.Version`** (internal/version.go) — セマンティックバージョンのパース・比較。`NewVersion(buf)`, `Lt()`, `Gt()`, `Eq()` 等
- **`settings`の i18n 機能** (settings/languages.go) — Go側UI文字列の翻訳。`InitI18n(code)` / `T(key)` 等（Skill: `binder-i18n-theme` 参照）

### Wails v3 固有の注意点

- `api.App` は `application.NewService(app)` で登録されるが、`ServiceStartup` インターフェースは実装していない。初期化は `main()` から `app.Setup()` を直接呼ぶ
- アプリ取得: サービス内から `application.Get()` で `*application.App` を取得
- ウィンドウ作成: `app.Window.NewWithOptions(opts)` / ダイアログ: `app.Dialog.OpenFile()...` / ブラウザ: `app.Browser.OpenURL(url)`
- フロントエンドバインディング: `frontend/bindings/binder/api/app.js`（Goパッケージパスに対応、手動編集不可）
- ビルド設定: `_cmd/binder/Taskfile.yml` + `_cmd/binder/build/config.yml`（Wails v2の `wails.json` はメタデータのみ残存）
- バージョン: `_cmd/binder/main.go` が `//go:embed version` で `_cmd/binder/version` ファイルからバージョン文字列を取得

### データフロー

全ての変更操作（ノート・ダイアグラム・アセットの作成/編集/削除）は以下のパターンに従う:
1. フロントエンドがWailsバインディング経由で`api.App`のメソッドを呼び出す
2. `api.App`が`Binder`のビジネスロジックに委譲する
3. `Binder`が`fs`でファイルシステムに書き込み、`db`でメタデータを更新する
4. `fs`が変更をgitコミットする
5. JSONレスポンスをフロントエンドに返す

例外: ルートファイル（Skill: `binder-plugin-rootfile`）は保存時にコミットせず、未記録一覧から記録する。

### 設定

ユーザー設定はホームディレクトリの`binder/setting.json`に保存（ウィンドウ位置、git設定、外観）。`settings/`パッケージで管理。

## UI用語

UIではGit用語を隠蔽し、ユーザーフレンドリーな表現を使用する:
- **コミット → 記録**（英語: Record）。コード内部の変数名・イベント名・ファイル名は `commit` のまま維持し、言語ファイル（`setup/_assets/languages/`）の表示ラベルのみ「記録」を使用する
- **未コミット → 未記録**（英語: Unrecorded）

## ワークツリー開発の必須手順

ワークツリーを作成したら、**他の作業より先に**以下を順番に実行すること。

### 1. node_modules の Junction 作成（必須・最優先）

ワークツリーには node_modules が存在しない。メインリポジトリの node_modules への Junction を作成する。

```powershell
# binder
New-Item -ItemType Junction -Path "_cmd\binder\frontend\node_modules" -Target "D:\Go\Projects\binder\_cmd\binder\frontend\node_modules"
# lite
New-Item -ItemType Junction -Path "_cmd\lite\frontend\node_modules" -Target "D:\Go\Projects\binder\_cmd\lite\frontend\node_modules"
```

**禁止: ワークツリー内での `npm install`**。Junction が実体ディレクトリに上書きされ、メインリポジトリ側の node_modules を破壊する。

Junction の安全な解除は `cmd /c rmdir <link>`。`Remove-Item -Recurse` はリンク先の実体を削除する危険があるため使わない。

### 2. フロントエンドバインディング生成（必須）

```bash
cd _cmd/binder && wails3 task common:generate:bindings
```

Go API やフロントエンドを触る作業では、バインディングがないとビルドもテストも通らない。API 変更を行った場合はその都度再生成する。

**禁止: バインディングのコミット**。`_cmd/binder/frontend/bindings/` は `.gitignore` 対象の生成物であり、`git add` や `git add -f` でステージングしてはならない。バインディングはローカルでのビルド・テスト用に生成するもので、各環境で都度生成される前提。

### 注意: task dev と Junction

`wails3 dev`（`task dev`）の Taskfile は `install:frontend:deps` ステップで `npm install` を実行するため、Junction が削除される。dev 実行後に再度 Junction が必要な場合は作り直すこと。ただし `wails3 dev` は bindings を自動生成するため、dev 時の bindings 不足は問題にならない。

## コーディング規約

- エラーラッピングは`golang.org/x/xerrors`を使用（`xerrors.Errorf("context: %w", err)`）
- ロギングは`log/slog`と`log/`パッケージのヘルパーを使用（`log.PrintTrace()`, `log.PrintStackTrace()`）
- IDはUUID v7（`github.com/google/uuid`）
- Wailsアプリのエントリーポイントは`_cmd/binder/`（アンダースコアプレフィックスに注意）
- コードベース全体に日本語コメントあり
- コミットメッセージはConventional Commits形式（`fix:`, `feat:`, `docs:`）。末尾に「Glory to mankind.」を付ける
- `api/json/`パッケージはAPI向けのモデル型を含み、`db/model/`とは別
- DAOファイルは`_dao.go`サフィックスを使用（自動生成、手動編集不可）
- `fs`パッケージはOSファイルシステムとインメモリファイルシステム（billy）の両方をサポート（テスト用）
- セマンティックバージョン操作は`internal.Version`を使用（直接文字列比較は不可）
