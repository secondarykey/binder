# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Binderは技術文書作成向けの実験的なデスクトップMarkdownエディタ。**Wails v2**（Go + React）でフレームレスのデスクトップアプリケーションを構築している。コンテンツはローカルgitリポジトリにファイルとして保存され、メタデータはCSVベースのSQLテーブル（csvq）で管理される。

## ビルド・開発コマンド

### 前提条件
- Go 1.22+
- Node.js + npm
- Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### 開発
```bash
# 開発モードで起動（_cmd/binder/ から実行）
cd _cmd/binder && wails dev
```

### ビルド
```bash
# プロダクションビルド（_cmd/binder/ から実行）
cd _cmd/binder && wails build
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

### フロントエンドのみ
```bash
# _cmd/binder/frontend/ から実行
npm install
npm run dev      # Vite開発サーバー
npm run build    # プロダクションビルド
```

## アーキテクチャ

### レイヤー構成

```
Reactフロントエンド (JSX, MUI, Vite)
    ↓ Wails IPCバインディング
api/ — Go APIレイヤー（App構造体をWailsにバインドし、JSにメソッドを公開）
    ↓
ルートパッケージ (binder.go, note.go, diagram.go 等) — コアビジネスロジック（Binder構造体）
    ↓
db/  — CSVベースのSQLデータベース（csvq-driver）、DAO
fs/  — Gitバックのファイルシステム（go-git）、ファイルI/O、コミット管理
```

### 主要な型

- **`Binder`** (binder.go) — 中心的なオーケストレータ。FileSystem、DB、HTTPサーバーへの参照を保持。ライフサイクル: `Load()` → 使用 → `Close()`
- **`api.App`** (api/api.go) — Wailsにバインドされる構造体。フロントエンドからのメソッド呼び出しを受け、`Binder`に委譲
- **`fs.FileSystem`** (fs/fs.go) — go-gitリポジトリのラッパー。全コンテンツ変更はここを経由し、gitコミットされる
- **`db.Instance`** (db/db.go) — csvqを使用したCSVファイルへのSQLインターフェース。テーブル: notes, diagrams, assets, templates, config

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
- **contents/LeftMenu/** — @mui/x-tree-viewを使ったノート・ダイアグラムのツリー表示
- **wailsjs/go/** — Wailsが自動生成するTypeScriptバインディング（手動編集不可）

### ドメインエンティティ (db/model/)

- **Note** — 階層構造（parentId）、Markdownコンテンツ、テンプレートと公開機能をサポート
- **Diagram** — Noteと同様の構造を持つMermaidダイアグラム
- **Asset** — ノートに添付されるバイナリ/テキストファイル
- **Template** — 公開用の再利用可能なHTMLレイアウト/コンテンツテンプレート
- **Config** — アプリケーション設定

### データベース (db/)

csvq（CSVファイルに対するSQL）を使用。binderリポジトリ内の`db/`ディレクトリにCSVテーブルファイルを格納。スキーママイグレーションは`db/convert/`で処理。

### 設定

アプリケーション設定はユーザーのホームディレクトリに`.binder.json`として保存（ウィンドウ位置、git設定、外観）。`settings/`パッケージで管理。

## コーディング規約

- エラーラッピングは`golang.org/x/xerrors`を使用（`xerrors.Errorf("context: %w", err)`）
- ロギングは`log/slog`と`log/`パッケージのヘルパーを使用（`log.PrintTrace()`, `log.PrintStackTrace()`）
- IDはUUID v7（`github.com/google/uuid`）
- Wailsアプリのエントリーポイントは`_cmd/binder/`（アンダースコアプレフィックスに注意）
- コードベース全体に日本語コメントあり
- コミットメッセージはConventional Commits形式（fix:, feat:）
- `api/json/`パッケージはAPI向けのモデル型を含み、`db/model/`とは別
- DAOファイルは`_dao.go`サフィックスを使用
- `fs`パッケージはOSファイルシステムとインメモリファイルシステム（billy）の両方をサポート（テスト用）
