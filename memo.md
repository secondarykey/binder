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

# Used

## Plugin設計

### Editor

vim 化
https://github.com/toplan/Vim.js
他は日本語がきついかも


# 検索機能

どうすっかなぁ、、、、

# アクセストークン

https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

# Issue

- クローン
- ブランチ作成
- Push

# UI


## 設定画面　

- 名前
- メールアドレス
- 認証情報

## 開くBinderを指定する画面

開いたBinderを履歴的に残しておくか？

New
load(local)
import(remote)

## Push

現在のステータスを表示
※コミットしてないものを表示して保存できるようにする

## 履歴一覧

ファイル単位で履歴を処理
...複数ファイルをコミットした場合の動作
履歴表示？


### api

OpenXxxx() -> テキストの中身
SaveXxxx() -> テキストの保存
GetXxxx() -> メタデータの取得
EditXxxx() -> メタデータの設定(追加も行う)

PublishXxxxx() -> 出力物の保存
ConvertXxxxx() -> ID変更
RemoveXxxx() -> 削除
