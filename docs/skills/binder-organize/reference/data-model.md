# バインダーのデータ構造

## ディレクトリレイアウト

```
<バインダー>/
  binder.json          ← バインダーであることの目印。version / name / detail 等
  notes/{id}.md        ← ノート本文（Markdown + テンプレート関数）
  diagrams/{id}.md     ← Mermaid の生ソース（```mermaid フェンスは付けない）
  assets/{id}          ← 添付ファイル（拡張子なし・中身は元のバイナリ/テキスト）
  assets/meta/{note_id}← ノートの OGP 画像
  layers/{id}.json     ← 画像へのシェイプ重ね（触らない）
  templates/{id}.tmpl  ← 公開用 HTML テンプレート（触らない）
  plugins/marked/*.js  ← marked 拡張（触らない）
  db/*.csv             ← メタデータ（csvq = CSV に対する SQL）
  docs/                ← 公開された HTML/SVG。アプリが生成する（触らない）
```

`id` は全て **UUID v7**。例外はトップページのノートで、id は固定文字列 `index`。

## テーブル

**列は必ず実ファイルのヘッダ行から読むこと。** 以下はアプリ最新版が新規作成する列であり、
古いバインダーでは列が欠けていることがある（`private` 列が無い、`layers.csv` が無い等）。

### structures.csv — 全エンティティの階層情報（唯一の階層の正）

```
id,parent_id,seq,type,name,detail,alias,publish_date,republish_date,private,created_date,created_user,updated_date,updated_user
```

| 列 | 内容 |
|---|---|
| `id` | UUID v7。`index` のみ固定文字列 |
| `parent_id` | 親の id。`index` 行だけが空文字 |
| `seq` | 同じ親の中での並び順。1 始まり |
| `type` | `note` / `diagram` / `asset` / `layer` |
| `name` | ツリーに出る表示名。**要エスケープ** |
| `detail` | 説明文。**要エスケープ** |
| `alias` | 公開ファイル名。note / diagram は id と同値が既定。asset は元のファイル名 |
| `publish_date` | 初回公開日時。未公開はゼロ値 |
| `republish_date` | 最終公開日時。未公開・公開解除はゼロ値 |
| `private` | `true` / `false`。列が無いバージョンもある |
| `created_user` / `updated_user` | 既存行に倣う（アプリの手動操作は `user`、システム処理は `App`） |

`templates.csv` は structures に載らない（自前で name/type/seq を持つ）。

### 実体テーブル

```
notes.csv     : id,layout_template,content_template,created_date,created_user,updated_date,updated_user
diagrams.csv  : id,style_template,created_date,created_user,updated_date,updated_user
assets.csv    : id,binary,mime,created_date,created_user,updated_date,updated_user
layers.csv    : id,created_date,created_user,updated_date,updated_user
templates.csv : id,type,name,detail,seq,created_date,created_user,updated_date,updated_user
```

- `notes.csv` の `layout_template` / `content_template` はテンプレートの id。
  **同じ親の兄弟ノートからコピーする。** 推測しない。値が空でも動くが表示が崩れる
- `diagrams.csv` の `style_template` は空でよい
- `assets.csv` の `binary` は真偽値、`mime` は `image/png` 等

## type と実体ファイルの対応

| type | 実体ファイル | 実体テーブル |
|---|---|---|
| `note` | `notes/{id}.md` | `notes.csv` |
| `diagram` | `diagrams/{id}.md` | `diagrams.csv` |
| `asset` | `assets/{id}` | `assets.csv` |
| `layer` | `layers/{id}.json` | `layers.csv` |

structures 行・実体テーブル行・実体ファイルの **3 点セットが揃って初めて**
アプリのツリーに正しく現れる。

## 値のエスケープ

`name` / `detail` などの文字列列は、CSV を壊さないようアプリ側で以下に置換される。
**書き込むときは同じ置換を適用し、読むときは戻すこと。**

| 元 | CSV 上 |
|---|---|
| 改行 `\n` | `&#10;` |
| 半角空白 ` ` | `&#32;` |
| ダブルクォート `"` | `&#34;` |
| カンマ `,` | `&#44;` |

半角空白まで置換される点に注意。既存行を見れば実際の書かれ方が分かる。

## 日時の書式

- 通常値: `2026-03-21T16:23:07.7503334+09:00`（ローカルオフセット付き RFC3339、小数以下 7 桁）
- ゼロ値: `0001-01-01T00:00:00Z`

新規行の `publish_date` / `republish_date` は**必ずゼロ値**にする。
`created_date` / `updated_date` は現在時刻。

## アプリ側の自動修復（RunDoctor）

バインダーを開くたびに整合性が検査・修復される。書き込みの安全設計はこれに依存している。

| ズレ | 修復 |
|---|---|
| structure 行はあるが実体ファイルが無い | **空ファイルを再作成**（本文は失われる） |
| structure 行はあるが実体テーブル行が無い | 最小メタデータで行を復元 |
| 実体ファイルはあるが structure 行が無い | 行を復元し **index 直下**へ（name = id） |
| `parent_id` が存在しない / 自己参照 | index 直下へ付け替え |

**「実体ファイルを先に書き、CSV を後に書く」**のはこの表の 1 行目と 3 行目の差による。
逆順にすると中断時に本文が消える。

## marked プラグインの有効範囲（重要）

プラグインに on/off のフラグは無い。**ファイルがそこに在ることが「有効」**。
ただし置き場所で意味が変わる。

| 場所 | 意味 |
|---|---|
| `<バインダー>/plugins/marked/*.js` | **これだけがレンダリングに使われる**（`GetPlugins("marked")`）。git で共有され、公開HTMLにも効く |
| `~/.binder/plugins/marked/*.js` | **ライブラリ**。アプリのプラグイン設定から選んでバインダーへコピーするための置き場で、これ自体は描画に効かない |

つまり `~/.binder/plugins/marked/containers.js` があっても、そのバインダーの
`plugins/marked/` に無ければ `::: warning` は**素のテキストとして表示される**。

**プラグインは CSS を持たない。** `ReadPlugins` が読むのは `.js` だけで、
`containers.js` の `.container` も `github-alerts.js` の `.binder-alert` も
アプリのテーマ・公開テンプレートのどちらにも定義が無い。
入れただけでは枠のない素のテキストとして出るので、スタイルは別途当てる
（当て先は SKILL.md の「スタイルの追加」）。

有効化 ＝ ライブラリから `plugins/marked/` へファイルをコピーすること。
アプリのプラグイン設定の「インストール」と同じで、内部でも同じことをしている。
読み込み順はファイル名のアルファベット順。

**ユーザに無断で有効化しないこと。** プラグインはバインダー全体の描画を変え、
git で共有され、公開ページにも影響する。必ず確認を取る。確認は散文で依頼せず、
`AskUserQuestion` の選択肢として「スキルがコピー / ユーザがアプリのプラグイン設定から入れる /
有効化しない」の 3 つを出す（SKILL.md の 2.5 を参照）。

## 触ってはいけないもの

- `docs/` — アプリが公開時に生成する。手で書いても次の公開で上書きされる
- `templates/*.tmpl` — 壊すと全ページの表示が崩れる
- `user_data.enc` — 暗号化された git 認証情報
- `layers/*.json` — 画像上のシェイプ座標。手で書く意味がない
