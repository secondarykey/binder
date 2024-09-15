# 移行

## 公開までにやること

- ブログ自体を公開
- 公開してないもの
  - 更新しているもの
  - 公開してないもの
- 履歴の表示(ロールバック)
- idの変更
- プレビューの表示なしを作成
  - アニメーションを可能にする
  - フローティングを作成
- PR作成
- 初期動作の見直し
- Git周りの確認
- ツリーの表示順
  - 件数が増えた時の表示を考える
  - 非表示モードとかを作るかな？
- Config,Settingの見直し
  - 個人設定か全体設定かのチーム作成を考える
- デザインテンプレートを作成

### PR

https://github.com/{org}/{repo}/compare/{remote}...{local}?quick_pull=1

# 旧データ

- work下にある

*以下転載　*
# コミットコメントの仕様

## 定型文

### install時

- install   : Database
- install   : Templates
- install   : Sample

### 追加時

- create    : Note {Name}
- create    : Data {Name}
- create    : Assets {Name}

### 設定変更

- update    : Binder
- update    : Note {Name}
- update    : Data {Name}
- update    : Assets {Name}

### 編集作業

- auto save : Note {Name}
- auto save : Data {Name}
- save      : Note {Name}
- save      : Data {Name}

出力時、編集前のデータがあったらコミットされます。

### 出力

- update    : Templates
- generate  : Note {Name}
- generate  : Index HTML

### 他処理

- move id   : Note {oldId} -> {newId}
- remove    : Note {name}
- remove    : Data {name}


*以下テンプレート仕様*

# テンプレートの仕様書

BinderはテンプレートによってノートのHTMLを作成します。ページとしては

- Home = トップページ
- NoteList = ノートの一覧
- Note = ノート

の三種類あり、これらのベースになるテンプレートが「Layout」になります。

HTML で記述しますが、ノート特有の値などを利用するにはGo言語のテンプレートを利用していきます。
Binderは変数や関数を準備していますので、それらをここに書いていきます。

レイアウトには

<pre><code>
{{ `{{ template "Content" . }}` }}
</code></pre>

と記述を行ないます。この記述を行ってないレイアウトはコンテンツ別に表示が不可能なので必ず記述してください。

## 変数

### Home オブジェクト

トップページに関連するオブジェクトになります。
バインダーに設定されている値が入っています。

- Name
- Detail
- Link（トップページのリンク）

### Page オブジェクト

NoteListを利用する場合にアクセスできます。

- List
- Now
- First
- Last
- Prev
- Next

それぞれ、IndexとLinkを持っています。

### Note オブジェクト

選択されているノートオブジェクトの値が表示されます。ノートテンプレートでしか設定されませんのでノードテンプレートで利用してください。

- ID
- Name
- Detail
- Created
- Updated
- Publish
- Link
- Image

HomeやNoteListでノートの表示を行いたい時は後述する関数などで設定できるはずです。

### Marked

ノートで記述したマークダウンを表示します。
Markedで変換されたHTMLを表示します。
ノートテンプレートのみ利用が可能。

## 関数

### latestNotes n

最新のノートをn件表示します。
レイアウト、ホームに利用することが多いと思います。

※公開日付が最新の５件になりますが、ローカルでの表示時には「更新日付」で処理が行われます。

このようなリスト形式のデータは

```
<ul>
{{ "{{ range latestNotes 5 }}" }}
  <li><a href="{{"{{ .Link }}"}}">{{"{{ .Name }}"}}</li>
{{ "{{ end }}" }}
</ul>
```

というように扱います。
latestNotesで取得できるNoteオブジェクトはNoteの仕様部分で利用方法を参照ください

### note "noteId"

ノートオブジェクトを返しますが、自分のノート以外にはあまりアクセスするべきではないかもしれません。

### assets id

データのパスを設定する場合に利用します。

```
{{ `{{assets "test"}}` }}
```

とするとノートに登録したデータのURLを返してくれます。
全体に登録したデータはpublicAssetsを利用します。

### publicAssets id

例えばJSファイルをAssetsとして登録した場合

```html
<script src="{{ "{{publicAssets material.min.js}}" }}"></script>
```

のようにして読み込みます。

### noteAssets id noteId

ノート内にトップページなどで表示するデータを設定するのはあまり想定はしていませんが、アクセスすることは可能です。（全体のアセットとして登録するべき）

```
{{ "{{noteAssets test noteId}}" }}
```

通常、ノートテンプレートでのアクセスが主だと思いますので、後述するselfAssetsを利用してください。

### lf2sp src

Detailは改行を入力することが可能ですが、HTML的に改行をされると困る場合に利用します。
※lf2comma,lf2brなどがあります。

### replace src before after

改行以外で変換したいものがある場合はreplaceを利用してください。

### NoteList の利用方法

Binderでリストページは１ページにConfigで設定した「ListNum」の件数文のノート表示を行うことができます。初期値は０になっていてすべての表示を行うページを１ページ作成します。

次のページは.Page.Next,前のページは.Page.Prevに入っています。
※存在しない場合のIndexは0になっています。


# pageNotes

そのページのノートリストが取得できます。


# prevPages n

それより前のページが存在しない場合、０件のページが返ってきます。

# nextPages n

これ以上ページが存在しない場合、０件のページリストが返ってきます。


## 日付に関して

日付データは「ISO-8601」の文字列で返しています。例えば

```
{{ `{{ .Note.Updated }}` }}
```

と記述を行えば、

```
2024-01-25T07:58:11+09:00
```

のような日付表示が可能です。

## localeDate

```
{{ `{{ localDate .Note.Updated }}`}}
```

と行うと

```
2024/1/25 7:58:11
```

という表示になり、見た人のLocaleでの記述が可能になります。

中身は

<pre><code>
{{ `
<script>
const date = new Date("{{ .Note.Updated }}");
document.write(date.toLocaleString())
</script>
` }}
</code></pre>

というスクリプトを書いています。

## フォーマットを指定したい場合

フォーマットを指定したい場合はメンドウですがJavaScriptなどでパースしたりして処理を行う必要が出てきます。

# 注意点

markedもmermaidも内部的には持っていますが、公開するページには基本的に読み込んだデータなどで動作する為、

- 内部のマークダウンをmermaid化したい
- コードハイライトをしたい

などについては公開するテンプレートで処理を行う必要があります。


*テンプレート問題*

# Goテンプレート問題

この問題が起こる人は少ないと思いますが、念のため書いておきます。

{{ $x := `{{ }}` }}

```
{{ $x }}
```

はGoのテンプレート上特殊な文字列になる為、テンプレート処理になり、書き込むことができません。
その為

```
{{ $x := `{{ $x := "{{ }}" }}` }}
{{ $x }}
```

という風に変数に書き込んで書く必要があります。
文字列である「"」が存在している為、「`」で囲っている必要があります。

safe関数も準備していて、

```
{{ $x := `{{ safe "{{ }}"}}` }}
{{ $x }}
```

とやっても可能です。

ただこのテンプレートの通り、に書いてしまうと「{{ "&#34;" }}」 が存在する為、highlight.js がで書きだすと、実際の文字列として書き込むことができなくなってしまいます。

そのため

<pre><code>{{ $x := `{{ $x := "{{ }}" }}` }}
{{ $x }}
{{ safe "<pre><code>{{$x}}</code></pre>" }}
</code></pre>

のように書く必要が出てきます。
かなりメンドウくさいですが、まぁめったに書くことがないと思うので大丈夫かな？


