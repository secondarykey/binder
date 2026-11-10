# AGENTS.md

このディレクトリは [Binder](https://github.com/secondarykey/binder)（Markdown エディタ）のバインダーです。
AI のエージェントがここを編集するときの決まりを書いています。

## 編集の前に

- **Binder がこのバインダーを開いている間は編集しないでください。**
  Binder とほかのツールが同時に書くと、`.git/index` や `db/*.csv` が壊れます。
  Binder は開いている間 `.git/binder-open.lock` にロックを掛けています。
  このファイルを排他で開けなければ Binder が開いています（ファイルが残っていても、開ければ閉じています）。
- 記録されていない変更があれば、先に Binder で記録してもらってください。

## 構成

| 場所 | 中身 |
|---|---|
| `notes/{id}.md` | ノートの本文 |
| `diagrams/{id}.md` | 図（Mermaid） |
| `db/*.csv` | 一覧と情報。`structures.csv` がツリー（`parent_id` と `seq`） |
| `templates/` | 公開ページのテンプレート |
| `docs/` | 公開用に生成した HTML。直接編集しない |

## 書き込みの順番

新しく作るときは、必ず次の順番で書いてください。

1. 実体ファイル（`notes/{id}.md` など）
2. 実体テーブルの行（`db/notes.csv` など）
3. `db/structures.csv` の行

途中で止まっても、Binder が次に開いたときに直せる向きです。
逆にすると、Binder は本文の無い行を見つけて空のファイルを作るため、本文が失われます。

- `id` は UUID v7
- CSV の列はヘッダ行で決まります。版によって違うので、必ずヘッダ行を読んでから書いてください
- `name` / `detail` の `,` `"` 半角空白 改行 は `&#44;` `&#34;` `&#32;` `&#10;` に置き換えます
- 削除は、頼まれたときだけにしてください

## 終わったら

- 変更は git で記録（コミット）してください。`db/*.csv` の変更は Binder の未記録一覧に出ないため、記録しないとユーザから見えません。
- 次に Binder で開いたとき、食い違いを直した場合はその内容が表示されます。

ノートの整理（統合・分割・ツリーの組み替え・図の差し込み）には、手順と検証スクリプトをまとめた
[binder-organize](https://github.com/secondarykey/binder/tree/main/_docs/skills/binder-organize) スキルが使えます。
