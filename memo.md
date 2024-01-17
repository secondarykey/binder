# binder is markdown editor

binderの目標は、技術文章をテキストで作成する為のエディタです。

ノートを追加して、マークダウンで文章を書いていき画像は mermaid で書いていきます。
もちろん既存のデータも追加できます。

特徴としてはそれらを自動でGitで管理しているところで、
画像の変更も抑えることができます。

また、構成をGitHub Pagesに合わせている為、それをそのまま公開することができます。

# 公開までやること

- デフォルトのバインダーを作る
- ファイルを開くインターフェース

## Binder = Directory = Repository

ファイル保存場所を設定
データ構造にあってない場合の設定方法
スキーマバージョンを残す
トップページ用の表示と作成されたノート一覧を設定できます。

## Note = Page

テキスト(マークダウン)で書いていきます。
マークダウンの仕様は marked に依存します。

https://github.com/markedjs/marked

## Data = Image(etc)

データはノートにぶらさげることができます。
※Binderにも登録できます
また直接アップロードした場合は単純にファイルとして追加されます。

## Template

Go言語のテンプレートに依存します。
各テンプレートに利用できる変数や関数があります。

### index.tmpl

トップページ用のテンプレートです

- Name
- Detail

### list.tmpl

作成されているページのリストを作成します。

- Notes
- Num
- Prev
- Pages
- Next

### note.tmpl

ノートを表示する為のテンプレートです。

- Title
- Detail
- Publish
- Created
- Updated
- Body Noteデータを変換したHTML

### layout.tmpl

すべてのページで利用するテンプレートです
index.tmplと同じデータを利用できます。

- Content 上記テンプレートで変換された値
- Type index,list,note 処理時対象データのタイプ


## データベース

csvq を利用してデータ管理する
大事なのはGitで共有する為、データベースもGitにしておく

テンプレートを変更するかを考える

    config.csv
      -> 端末に依存する設定は保存しない

    notes.csv
      note_id,title,detail,created,updated,published

      IDはURL,ファイルパスの文字列を禁止
      //指定しない場合は、何らかのID

    data.csv

      data_id,plugin_id,note_id,detail,created,updated,published

      IDはURL,ファイルパスの文字列を禁止
      IDを変更できるようにする

    plugin_idによって変換する
      note_idがないものは全体公開用

# コミット処理

テキストをコミットした場合と、出力した場合のUIは違うので気を付ける


# コンパイル

ノートコンパイル

  note_id内をコンパイル

データコンパイル

  data_idをコンパイル

インデックスコンパイル

  index.tmplとlist.tmplを行う

バインダーコンパイル

  構造チェック


# samples

- blog

  ブログとして機能する

- binder design

# Git

## 下書き

"draft: %s" で残す

## ブランチ

基本的にマシン名として、
pushもそのまま行ってPRで作業


## Convert Plugin

ファイルを編集した場合に変換を行うことができます。

変換したものをファイルとして保存します。
出力されたものも同じようにGitで管理対象になります。

## 変換、出力を利用してブログを書く

変換、出力を利用してブログを作成してみましょう。

テンプレートを指定

テキストを追加

変換対象をHTMLに変更

HTMLを表示箇所に設定

# Used

# アプローチ


## Plugin設計

### Input

構造情報などを編集する
ファイルを追加する時に名称などを設定する

CSV 管理できるようにする
- 文字列
- 数値
- 時刻
- ファイル

### Editor

vim 化

https://github.com/toplan/Vim.js

他は日本語がきついかも


### Convert

テキストを変換

### Generate

変換データを管理化におく

# 検索機能

どうすっかなぁ、、、、

# アクセストークン

https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

# Issue

- クローン
- ブランチ作成
- Push

# CRUD Editor

行を定義

  型 入力規則?
  ID 指定
  自動出力
  編集有無
  必須

行を追加
行を編集
行を削除


# UI

技術的問題

- 変換表示仕様

HTMLの場合、テンプレートがあるのがサーバサイドの為、
一旦その文字列を持ってきて、該当箇所に埋め込む。

出力を保存時はそのHTMLを保存？

テンプレート編集はどうするの？

mermaid時はそのまま画像を表示するのみ。

## 設定画面　

起動位置/config.json にでも残す

- 名前
- メールアドレス
- 認証情報

## 開くBinderを指定する画面

開いたBinderを履歴的に残しておくか？

New
load(local)
import(remote)

## Binder設定

開いているBinderの設定

- メインブランチ名(master)
- 作業ブランチ名(基本的にマシン名)
- 下書きの保存時間

## 一覧(ツリーかな？　)

- ノート
- データ
- 不明なディレクトリ

## テキスト編集

ツリーはこの時、ノートのデータ一覧を開く

## データ表示

編集対象にしているデータを開く
保存するボタン

## Push

現在のステータスを表示
※コミットしてないものを表示して保存できるようにする

## 履歴一覧

ファイル単位で履歴を処理
...複数ファイルをコミットした場合の動作
履歴表示？

### 作業


