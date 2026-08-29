# Markdown 中の描画関数

ノート本文（`notes/{id}.md`）とテンプレートは **Go の text/template** として先に評価され、
その結果が Markdown としてレンダリングされる。つまり本文に `{{...}}` を書くと図や画像や
子ノート一覧が展開される。

引数は Go テンプレートの流儀で **空白区切り・文字列はダブルクォート**。

```
{{drawDiagram "019d0f46-be88-76ab-8673-f0dee8535ce5"}}
```

`{{` の直後に関数名、id は必ずダブルクォートで囲む。カンマや括弧は使わない。

## よく使うもの

### `{{drawDiagram "<diagram_id>" ["<class>"]}}`
Mermaid 図を描画する。`diagrams/{id}.md` の中身を Mermaid ソースとして扱う。
第 2 引数で CSS クラスを追加できる（常に `binderSVG` が付く）。

### `{{assetsImage "<asset_id>" ["<class>"]}}`
アセットを `<img>` タグとして出す。画像の差し込みはこれ。常に `binderAssets` クラスが付く。

### `{{assets "<asset_id>"}}`
アセットの URL だけを返す。`<a href="{{assets "..."}}">` のように自分でタグを書きたいときに使う。

### `{{embed "<id>"}}`
他のノート、またはテキストアセットの中身をその場に展開する。
展開先も再びテンプレートとして評価される。

- **note と（テキストの）asset のみ**。diagram や layer を指定するとエラーになる
- **循環参照は不可**。A が B を embed し B が A を embed するとエラー表示になる

### `{{childNotes [件数] ["<note_id>"] ["seq"]}}`
子ノートの一覧を返す。目次ノートの中核。

- 件数を省略 / `-1` で全件
- note_id を省略すると現在のノートの子
- 第 3 引数に `"seq"` を渡すと**ツリーの並び順**、省略すると公開日/更新日順
- `{{childrenNotes}}` は同じもの（別名）

```
{{range childNotes -1 "" "seq"}}
- [{{.Name}}]({{.Link}}) — {{.Detail}}
{{end}}
```

### `{{latestNotes <件数>}}`
バインダー全体の新しいノートを返す。トップページ向け。

### `{{breadcrumb}}`
現在のノートから index までの祖先を root→current の順で返す。

### `{{drawLayer "<layer_id>" ["<class>"]}}`
画像の上にシェイプを重ねたものを描画する。アプリの画像編集機能で作った layer 用。

## `childNotes` / `latestNotes` / `breadcrumb` が返す要素のフィールド

| フィールド | 内容 |
|---|---|
| `.Id` | ノート id |
| `.Name` | 表示名 |
| `.Detail` | 説明文 |
| `.Link` | 公開ページへのリンク |
| `.Image` | OGP 画像の URL |
| `.Publish` | 公開日時（RFC3339 文字列） |
| `.Created` / `.Updated` | 作成 / 更新日時（RFC3339 文字列） |

## 文字列・日付ヘルパー

| 関数 | 用途 |
|---|---|
| `{{formatDate .Publish "2006/01/02"}}` | RFC3339 文字列を Go のレイアウトで整形 |
| `{{localeDate .Publish}}` | 閲覧者のロケールで表示する `<script>` を出す |
| `{{lf2br .Detail}}` | 改行を `<br/>` に |
| `{{lf2sp .Detail}}` | 改行を半角空白に |
| `{{lf2comma .Detail}}` | 改行をカンマに |
| `{{replace .Detail "旧" "新"}}` | 文字列置換 |
| `{{safe .X}}` / `{{lit .X}}` / `{{litURL .X}}` | HTML エスケープを回避して生出力 |

## 書くときの注意

- **参照先の id が実在しないと、ページに赤字の ERROR が出る。**
  図やアセットを差し込んだら必ず `scripts/Validate.ps1` で参照チェックを通すこと
- `diagrams/{id}.md` には **` ```mermaid ` フェンスを書かない**。中身は Mermaid ソースそのもの
- 本文に `{{` を文字として出したいときは Go テンプレートの
  `{{"{{"}}` を使う（滅多に必要にならない）
