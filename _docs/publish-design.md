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
デザイン用途で効くのは `childNotes` / `latestNotes` / `breadcrumb` / `prevNote` / `nextNote` /
`assets` / `assetsImage` / `drawDiagram` / `formatDate` / `lf2br`。

「前へ」「次へ」は `prevNote` / `nextNote` で作る。ツリーを深さ優先でたどった順
（親の次に子、同じ親の中は seq 順）で前後のノートを返し、無ければ nil。
引数に起点のノートの ID を渡すと、その下だけを順番にする（起点自身も含む。省略時はバインダー全体）。
非公開のノートは飛ばし、公開時は公開中のノートだけを数える。

```
{{ with prevNote "01a165e4-..." }}<a href="{{ .Link }}">前へ {{ .Name }}</a>{{ end }}
{{ with nextNote "01a165e4-..." }}<a href="{{ .Link }}">次へ {{ .Name }}</a>{{ end }}
```

前後のノートを公開・取り下げしても、すでに公開したページのリンクは変わらない。
公開し直すと反映される（`childNotes` と同じ）。

エントリ間のリンクは `link` を使う。種別ごとに関数を分けず、IDから
note / diagram / layer / asset を判定して公開時の相対URLを出し分ける。
第2引数を省略するとエントリ名がリンクテキストになる。

```
{{ link "01a06311-..." }}          → <a href="../pages/foo.html">ノート名</a>
{{ link "01a06311-..." "表示名" }}  → <a href="../pages/foo.html">表示名</a>
```

URLだけが欲しい場面（独自の属性を付けた `<a>`、CSS の `url()` 等）は `url` を使う。
解決の規則は `link` と同じ。

OGP の `og:url` / `og:image` のように**絶対 URL** が要る場所は `fullURL` を使う。
基準はバインダー設定の「サイトの URL」（`binder.json` の `siteUrl`）。空なら推し量る
（`docs/CNAME` があれば `https://<CNAME>/`、リモートが `github.com/<user>/<repo>` なら
`https://<user>.github.io/<repo>/`。docs だけを公開ブランチのサブディレクトリへ送る設定なら、その名前を後ろに付ける。
実体は [site_url.go](../site_url.go)）。どちらも分からないときは `url` と同じ相対パスを返し、公開時に警告する。

```
<meta property="og:url" content="{{ fullURL }}">                    → 今のページ
<meta property="og:image" content="{{ fullURL "01a06311-..." }}">  → エントリ（PNG などのアセット）
<meta property="og:image" content="{{ fullURL .This.Image }}">      → 今のページからの相対パス
```

SVG は多くの SNS で OGP 画像として使えない。アセットは「画像を軽量化する」が有効だと WebP に変わるため、
OGP 用の画像は軽量化を切ってから追加する。

```
<meta property="og:image" content="{{ url "01a06311-..." }}">
<a class="card" href="{{ url "01a06311-..." }}">...</a>
```

`link` はノート本文でも使える（本文も同じ FuncMap でテンプレート処理される）。
ただし marked が先に走るため `[表示名]({{ ... }})` `![alt]({{ url ... }})` の形は壊れる。
`link` が `<a>` タグごと返すのはこのため。**本文からは `link`、テンプレートからは `url`**。

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

ただし local と公開で挙動が変わるものがあるので、最終確認は公開後に行う。

| | プレビュー（local=true） | 公開（local=false） |
|---|---|---|
| `{{assets}}` | data URI で埋め込み | `docs/assets/{alias}` への相対パス |
| `{{drawDiagram}}` | Mermaid ソースを渡してブラウザで描画 | `docs/images/{alias}.svg` を `<img>` |
| `childNotes` | 未公開ノートも含む | 公開中のみ（取り下げたものは除く） |
| `{{link}}` | 公開時と同じ相対パス（プレビューでは押すとエディタで開く） | `docs/` 配下への相対パス |
| `{{url}}` | 公開時と同じ相対パス（プレビューの iframe は読み込めない） | `docs/` 配下への相対パス |
| `<script>` | 動かない（信頼したバインダーだけ動く） | 動く |

プレビューの iframe はアプリと同じオリジンで HTML を表示するため、スクリプトが動くと
アプリの機能（Wails のランタイム）を呼べてしまう。既定では `sandbox="allow-same-origin"`
で止め、バインダー設定の「プレビューでスクリプトを動かす」を有効にしたバインダーだけ動かす。
この信頼はバインダーの中ではなく `setting.json` の `trustedBinders` に持つ（取り込んだ相手が
書き換えられないように）。レイアウトで highlight.js などを使う場合、信頼していないバインダーの
プレビューには効かない。

公開したページのスクリプトは、訪問者のブラウザでふつうの Web ページとして動くため、
アプリの機能には届かない。ただし信頼していないバインダーでは、どう動くかを一度も見ないまま
公開することになる（取り込んだ他人の変更に紛れたスクリプトを、自分のサイトとして配ってしまう）。
そこで公開時、信頼していないバインダーのページにスクリプトがあれば
`scripts(ノートID): …` の警告を出し、フロントは専用の文で知らせる（`publish-warning.js`）。

`url` がプレビューでも公開時と同じURLを返すのは、モードで別物にすると
テンプレートを書く側が挙動を追えなくなるため。ただしプレビューの iframe は
srcdoc なのでこのURLを読み込めない。`<img src="{{ url ... }}">` は壊れた画像に
なる代わりに「プレビューでは表示できません」という表示へ置き換わる
（`_cmd/shared/frontend/editor/preview-unresolved.js`）。前回公開時の古い成果物を
黙って見せるより、解決できないと明示する方針。

プレビューでも図・画像を見たい場合は `drawDiagram` / `assetsImage` / `drawLayer` を使う。
プレースホルダはパスの形（`/images/` `/assets/` `/layers/`）から種別を導けた場合、
その代替も併記する。訂正ではなく代替の提示であることに注意（公開専用の画像として
意図的に `url` を使う書き方もあり、`drawDiagram` は `<div class="binderSVG">` で
包むため任意の属性を付けた `<img>` の置き換えにはならない）。

## スキル化するときの論点

- テンプレートは全ページに波及するため、`binder-organize`（内容の整理）とは
  危険度が違う。別スキルに分けるか、モードを分けるかは要検討
- Go テンプレートの構文検査を手元でやる手段が無い（ユーザ環境に Go は無い前提）。
  `{{...}}` の対応と既知の関数名・フィールド名のリントぐらいが現実的
- `{{assets}}` の参照先アセットが**公開済みか**は公開時に警告する（`warnUnreachable`、
  `link` / `url` も同じ）。プレビューでは data URI で綺麗に表示され、公開後に画像だけが
  404 になるため、公開したその場で伝える必要があった。
  警告は `Generate` / `GenerateAll` の戻り値としてフロントに渡り、スナックバーに件数が出る

## 参照

- 組み立て: [html.go](../html.go) `createHTMLTemplate` / `createDto` / `CreateNoteHTML`
- 関数: [html_func.go](../html_func.go) `defineFuncMap`
- フレーム: [fs/template.go](../fs/template.go) `AddTemplateFrame` / `StripTemplateFrame`
- 型: [api/json/template.go](../api/json/template.go) `layout` / `content` / `diagram`
- プリセット: `setup/_assets/install/{blog,document,simple}/`（`manifest.json` が対応関係の実例）
