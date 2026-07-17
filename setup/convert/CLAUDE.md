# バインダーレベルマイグレーション

バインダー（gitリポジトリ）を開く際に、`binder.json` のバージョンがアプリバージョンより古い場合に実行される。

## アーキテクチャ

```
setup/convert/convert.go  — オーケストレータ。Run() が全移行を順番に適用
  ├── setup/convert/db/     — CSVスキーマ変換（カラム追加・テーブル作成等）
  │   ├── core/core.go      — Converter型・Apply()フレームワーク
  │   └── {ver}/converter.go — 各バージョンのCSV変換ロジック
  └── meta.go               — binder.json の読み込み（db/schema.version フォールバック付き）
```

FS変更（ディレクトリ構造変更等）を伴う移行は独立パッケージを持たず、各 migration の `run` 内で直接 `os` パッケージを使う（後述）。

## 移行の流れ

1. `convert.Run(dir, ver)` が `binder.json` から旧バージョンを取得
2. `migrations` リスト（バージョン順）を走査し、旧バージョンより新しい移行を順次適用
3. 各 `migration` は DB変換とFS移行を自己完結した単位で実行
4. 全移行後に `binder.json` を更新し、git コミットで確定

## 移行の追加方法

新しいバージョンの移行を追加する場合:

1. DB変更がある場合: `setup/convert/db/{ver}/converter.go` に `Converter` 関数を作成
2. FS変更がある場合: 独立パッケージは作らず、`convert.go` の migration の `run` 内で直接 `os` パッケージを使って実装する（「FS操作を伴う移行」節参照）
3. `convert.go` の `init()` に:
   - バージョン変数（`v{ver}`）を追加
   - `migrations` リストに `migration{v{ver}, func(...) error { ... }}` を追加
4. `migrateState` に移行固有の状態が必要なら追加（例: git コミットの分岐制御）

## 各バージョンの移行内容

| バージョン | DB変換 | FS移行 | 備考 |
|-----------|--------|--------|------|
| 0.7.2 | なし | .gitignore 作成（user_data.enc 除外） | `migrateState.gitignorCreated` → `MigrateResult.UserDataRequired` |
| 0.9.2 | assets に mime カラム追加（拡張子からMIME判定） | なし | |
| 0.9.7 | structures に private 列追加（デフォルト false）、diagrams に style_template 列追加（デフォルト diagram_style）、templates に diagram_style レコード追加 | templates/diagram_style.tmpl 作成 | `migrateState.diagramStyleMigrated` で制御 |
| 0.10.2 | なし（空変換） | なし | layers テーブルは `db.EnsureTableFiles` で新規作成 |

0.4.8 以前の移行（0.1.0/0.2.0/0.2.1/0.2.2/0.3.3/0.3.4/0.4.5/0.4.7/0.4.8）の内容と実装パターンは `HISTORY.md` を参照。

## DB変換の仕組み (`setup/convert/db/`)

- `core/core.go` が `Converter` 型（`func(dir string, tables []*core.FileSet) ([]*core.FileSet, error)`）を定義
- `Apply(dir, converters)` が各コンバーターを順次適用し、変更されたCSVファイルを追跡
- 各 `{ver}/converter.go` は CSVファイルを直接読み書きする（csvq は使わない）

## FS操作を伴う移行

FS変更（ディレクトリ構造変更・ファイル作成等）を伴う移行は独立パッケージを持たず、`convert.go` の migration の `run` 内で直接 `os` パッケージを使う。現存する例は 0.7.2 の `.gitignore` 作成と 0.9.7 の `templates/diagram_style.tmpl` 作成で、いずれも `os.Stat` で存在確認してから作成する冪等な実装になっている。

## 最小サポートバージョン

`setup/convert/convert.go` に定数 `MinSupportedBinderVersion = "0.4.8"` があり、これ未満のバージョンのバインダーは開けない（旧アプリで一度開いて移行を済ませる必要がある）。移行エントリを将来削除する際は、(1) `HISTORY.md` に手法を記録した上で、(2) この定数を削除後に残る最古の移行が扱える境界のバージョンへ更新する、という手順を踏む。
