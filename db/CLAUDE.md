# データベース・ドメインエンティティ

## ドメインエンティティと構造 (db/model/)

スキーマ 0.2.0 から `structures` テーブルで階層構造を一元管理している。

- **Structure** — 全エンティティの共通階層情報: `id, parent_id, seq, type, name, detail, alias, publish_date, republish_date`。`publish_date/republish_date` は 0.4.7 でここに集約
- **Note** — Markdownコンテンツ: `id, layout_template, content_template`
- **Diagram** — Mermaidダイアグラム: `id`
- **Asset** — 添付バイナリ/テキストファイル: `id, binary`
- **Template** — 公開用HTMLレイアウト/コンテンツテンプレート: `id, type, name, detail, seq`

Note/Diagram/Asset は `ApplyStructure(s *json.Structure)` で Structure の情報（parent_id, name, detail, alias）を取り込む。

## データベースの仕組み

csvq（CSVファイルに対するSQL）を使用。binderリポジトリ内の`db/`ディレクトリにCSVテーブルファイルを格納。テーブル: notes, diagrams, assets, templates, structures。

**スキーマバージョン管理**:
- `binder.json`（バインダールートに配置）: `{"version": "x.y.z", "name": "...", "detail": "..."}` でアプリバージョン・バインダー情報を管理（0.4.5以降 `config.csv` は廃止）
- 旧形式（`db/schema.version`）は自動マイグレーション後に削除される

## マイグレーション

マイグレーションは **アプリレベル** と **バインダーレベル** の2種類がある。

**アプリレベルマイグレーション** (`setup/setup.go` の `migrateApp()`):
- `~/.binder/` 配下のアプリ全体の設定・リソースを更新する処理
- `setting.json` の `appVersion` フィールドで前回起動時のバージョンを記録し、バージョン変更を検出する
- バージョンが変わった場合または開発モードの場合に `UpdateDefaults()` を実行し、`_default/` のテーマ・言語ファイルを最新に上書きする
- `EnsureExists()` の末尾で呼ばれる。バインダーとは無関係にアプリ起動ごとに実行される

**バインダーレベルマイグレーション** (`setup/convert/`):
- 個々のバインダー（gitリポジトリ）内のDBスキーマ・ファイル構造を更新する処理
- `binder.json` のバージョンとアプリバージョンを比較し、古い場合に `setup.Convert()` → `convert.Run()` で移行を実行する
- バインダーを開く時にのみ実行される（`api.App.CheckCompat()` → フロントエンド確認 → `api.App.Convert()`）
- 各バージョンの移行詳細・移行の追加方法は `setup/convert/CLAUDE.md` を参照

## DAO コード生成

- `_cmd/gen/main.go` が `db/model/*.go` の構造体タグ（`db:"col_name"`, `db:"id:key"`, `db:"col:insert"`）を読んで `db/*_dao.go` を生成
- モデルを変更したらリポジトリルートから `go run ./_cmd/gen/main.go` で再生成すること
- DAOファイルは `_dao.go` サフィックス（自動生成、手動編集不可）
