# バインダーレベルマイグレーション

バインダー（gitリポジトリ）を開く際に、`binder.json` のバージョンがアプリバージョンより古い場合に実行される。

## アーキテクチャ

```
setup/convert/convert.go  — オーケストレータ。Run() が全移行を順番に適用
  ├── setup/convert/db/     — CSVスキーマ変換（カラム追加・テーブル作成等）
  │   ├── core/core.go      — Converter型・Apply()フレームワーク
  │   └── {ver}/converter.go — 各バージョンのCSV変換ロジック
  ├── setup/convert/fs/     — ファイルシステム移行（ディレクトリ構造変更等）
  │   └── migrate.go + convert{ver}.go
  ├── meta.go               — binder.json の読み込み（db/schema.version フォールバック付き）
  └── config.go             — 0.4.5移行用: config.csv 読み込みヘルパー
```

## 移行の流れ

1. `convert.Run(dir, ver)` が `binder.json` から旧バージョンを取得
2. `migrations` リスト（バージョン順）を走査し、旧バージョンより新しい移行を順次適用
3. 各 `migration` は DB変換とFS移行を自己完結した単位で実行
4. 全移行後に `binder.json` を更新し、git コミットで確定

## 移行の追加方法

新しいバージョンの移行を追加する場合:

1. DB変更がある場合: `setup/convert/db/{ver}/converter.go` に `Converter` 関数を作成
2. FS変更がある場合: `setup/convert/fs/convert{ver}.go` に `MigrateV{ver}()` を作成
3. `convert.go` の `init()` に:
   - バージョン変数（`v{ver}`）を追加
   - `migrations` リストに `migration{v{ver}, func(...) error { ... }}` を追加
4. `migrateState` に移行固有の状態が必要なら追加（例: git コミットの分岐制御）

## 各バージョンの移行内容

| バージョン | DB変換 | FS移行 | 備考 |
|-----------|--------|--------|------|
| 0.1.0 | assets に binary カラム追加 | なし | |
| 0.2.0 | structures テーブル新規作成、parent_id/name/detail を各エンティティから分離 | なし | |
| 0.2.1 | alias を各テーブルから structures に集約 | なし | |
| 0.2.2 | なし（空変換） | assets ディレクトリをフラット化 | `fs/migrate.go` 内 |
| 0.3.3 | templates からsnippet型削除、型名リネーム | なし | |
| 0.3.4 | templates に seq カラム追加 | なし | |
| 0.4.5 | config.csv を削除 | なし | name/detail を binder.json に移行。`migrateState.configMigrated` で制御 |
| 0.4.7 | publish_date/republish_date を structures に移動、notes/diagrams から削除 | docs/ ディレクトリ削除 | `migrateState.docsMigrated` で制御 |
| 0.4.8 | なし（空変換） | assets/{noteId}-meta → assets/meta/{noteId} にリネーム | |
| 0.7.2 | なし | .gitignore 作成（user_data.enc 除外） | `migrateState.gitignorCreated` → `MigrateResult.UserDataRequired` |
| 0.8.3 | assets に mime カラム追加（拡張子からMIME判定） | なし | |

## DB変換の仕組み (`setup/convert/db/`)

- `core/core.go` が `Converter` 型（`func(dir string) (*core.FileSet, error)`）を定義
- `Apply(dir, converters)` が各コンバーターを順次適用し、変更されたCSVファイルを追跡
- 各 `{ver}/converter.go` は CSVファイルを直接読み書きする（csvq は使わない）

## FS移行の仕組み (`setup/convert/fs/`)

- `migrate.go` が `MigrateV022()` を含む（小規模なのでファイル分割なし）
- `convert047.go` / `convert048.go` は個別ファイルで実装
- ディレクトリやファイルのリネーム・削除を直接 `os` パッケージで実行
