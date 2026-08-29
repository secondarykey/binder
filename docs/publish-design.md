# 公開HTMLのデザイン構造（調査メモ）

公開されるページの見た目が何で決まっているかを整理したもの。
「バインダーの公開サイトをデザインし直したい」という要望に対して、
**どこを触れば何が変わるか**を明らかにするのが目的。

将来この作業をスキル化する場合の土台も兼ねる（現時点ではスキル化していない）。

## 全体像

```mermaid
flowchart TD
    MD["notes/{id}.md<br/>Markdown + {{...}}"] --> ELM["本文HTML<br/>(.Marked)"]
    ELM --> CT
    subgraph TMPL["createHTMLTemplate() html.go:82"]
      LT["templates/{layout_template}.tmpl<br/>type=layout → define \"Pages\""]
      CT["templates/{content_template}.tmpl<br/>type=content → define \"Content\""]
    end
    CT -->|{{ template \"Content\" . }}| LT
    LT --> OUT["docs/pages/{alias}.html"]
    CSS["assets/{id}（mime: text/css）"] -.->|{{assets \"id\"}}| LT
    CSS -.->|別途 公開が必要| PUB["docs/assets/{alias}"]
```

1 ノート = **layout 1枚 + content 1枚**の組み合わせ。どちらを使うかは
`db/notes.csv` の `layout_template` / `content_template` 列（値はテンプレートの id）。

## 構成要素

| 触るもの | 実体 | 役割 |
|---|---|---|
| レイアウト | `templates/{id}.tmpl`（`type=layout`） | `<!doctype html>` 〜 `</html>`。`{{ template "Content" . }}` で本文を差し込む |
| コンテンツ | `templates/{id}.tmpl`（`type=content`） | 記事まわりのガワ。`{{ .Marked }}` が本文HTML |
| CSS | **テキストアセット**（`assets/{id}`、mime `text/css`） | layout から `{{assets "<asset_id>"}}` で参照する |
| 図のテーマ | `templates/{id}.tmpl`（`type=diagram`） | Mermaid の init JSON。`%%{init:...}%%` として図の先頭に付く |

テンプレートのメタ情報は `db/templates.csv`（`id,type,name,detail,seq,...`）。
**templates は `structures.csv` に載らない**（自前で name/type/seq を持つ唯一のエンティティ）。

## テンプレートに渡るデータ

`createDto()`（[html.go:140](../html.go)）が組み立てる。

| 式 | 内容 |
|---|---|
| `.Home.Name` / `.Home.Detail` | `binder.json` の name / detail |
| `.Home.Link` | ルートへの相対パス（階層の深さに応じて `./` `../` になる） |
| `.Note` / `.This` | 現在のノート（同じオブジェクト） |
| `.Note.Id` `.Name` `.Detail` `.Link` `.Image` | Image はOGP画像のURL |
| `.Note.Publish` `.Created` `.Updated` | RFC3339 文字列。`formatDate` で整形する |
| `.Marked` | 本文のHTML（`template.HTML` なのでエスケープされない） |

加えて `defineFuncMap()`（[html_func.go:23](../html_func.go)）の関数が全て使える。
デザイン用途で効くのは `childNotes` / `latestNotes` / `breadcrumb` / `assets` /
`assetsImage` / `drawDiagram` / `formatDate` / `lf2br`。

同梱プリセットの `index.tmpl` が実例として分かりやすい。

```
{{ range childrenNotes 4 }}
<a class="card-link" href="{{.Link}}">
<article class="card">
    <img src="{{ .Image }}">
    <p class="date">{{ formatDate .Publish "2006-01-02 15:04" }}</p>
    <p class="title">{{ .Name }}</p>
    <p class="body">{{.Detail}}</p>
</article>
</a>
{{ end }}
```

## テンプレートを書くときの規則

- **`{{ define }}` / `{{ end }}` のフレームをファイルに書かない。**
  読み込み時に `AddTemplateFrame()`（[fs/template.go:23](../fs/template.go)）が
  layout には `{{ define "Pages" }}`、content には `{{ define "Content" }}` を自動で巻く。
  手で書くと二重定義になる（旧形式との互換で `StripTemplateFrame` が剥がすが、頼らない）
- 新規ノートの既定テンプレートは **`seq` が最小のもの**が選ばれる
  （`FindDefaultLayoutTemplate` / `FindDefaultContentTemplate`）。
  既定を変えたければ `templates.csv` の `seq` を入れ替える
- content テンプレートは**何枚あってもよい**。プリセットも `content` と `index` の2枚を入れている

## CSS の扱い（落とし穴）

CSS はテンプレートではなく**アセット**。プリセットではこう定義されている。

```json
{"id": "019e3aa3-...", "name": "StyleSheet", "alias": "styles.css",
 "parentId": "index", "binary": false, "mime": "text/css", "file": "style.css"}
```

そして layout から `{{assets "019e3aa3-..."}}` で参照する。

**ノートを公開してもアセットは自動では公開されない。**
`PublishNoteStage()`（[note.go:371](../note.go)）が書き出すのは
`docs/pages/{alias}.html` と OGP画像だけ。CSS アセットは「未公開一覧」から
別途公開しないと、公開ページから参照先が 404 になる。

`{{assets}}` はプレビュー（local）では data URI を返すため、
**プレビューでは正しく見えているのに公開すると崩れる**という形で表面化する。

## 変更のやり方は2通り

どちらが良いかは状況による。

### A. 既存テンプレートを直接編集する

全ページの見た目をまとめて変えたいとき。手数が少ない。

- 変更前に必ずコミットしておく（壊れたら `git revert` / アプリの履歴から戻す）
- 確認中も全ページが新デザインになる。公開前なら問題ない

### B. 新しい content テンプレートを足して、ノート単位で切り替える

デザインを試したい・一部のページだけ別の見た目にしたいとき。

`content_template` は**ノートごとの列**なので、1枚のノートだけ新テンプレートに
向けて確認し、良ければ他のノートの `content_template` も書き換える、という進め方ができる。
既存デザインは最後まで無傷。

`type=content` を増やすのはコストが低い（`templates/{新id}.tmpl` +
`templates.csv` に1行）。layout を増やす場合も同じ。

## 確認方法

エディタのプレビューと公開HTMLは**同じ経路**（`CreateNoteHTML()`、`local` の真偽だけが違う）。
したがってテンプレートを直せばプレビューに即反映され、そこで見た目を詰められる。

ただし local と公開で挙動が変わるものが3つあるので、最終確認は公開後に行う。

| | プレビュー（local=true） | 公開（local=false） |
|---|---|---|
| `{{assets}}` | data URI で埋め込み | `docs/assets/{alias}` への相対パス |
| `{{drawDiagram}}` | Mermaid ソースを渡してブラウザで描画 | `docs/images/{alias}.svg` を `<img>` |
| `childNotes` | 未公開ノートも含む | 公開済みのみ |

## スキル化するときの論点

- テンプレートは全ページに波及するため、`binder-organize`（内容の整理）とは
  危険度が違う。別スキルに分けるか、モードを分けるかは要検討
- Go テンプレートの構文検査を手元でやる手段が無い（ユーザ環境に Go は無い前提）。
  `{{...}}` の対応と既知の関数名・フィールド名のリントぐらいが現実的
- `{{assets}}` の参照先アセットが**公開済みか**の検査は静的にできる
  （`structures.csv` の `republish_date` がゼロでないか）。上記の落とし穴に直結するので価値が高い

## 参照

- 組み立て: [html.go](../html.go) `createHTMLTemplate` / `createDto` / `CreateNoteHTML`
- 関数: [html_func.go](../html_func.go) `defineFuncMap`
- フレーム: [fs/template.go](../fs/template.go) `AddTemplateFrame` / `StripTemplateFrame`
- 型: [api/json/template.go](../api/json/template.go) `layout` / `content` / `diagram`
- プリセット: `setup/_assets/install/{blog,document,simple}/`（`manifest.json` が対応関係の実例）
