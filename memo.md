# binder is markdown editor

binderの目標は、技術文章をテキストで作成する為のエディタです。

ノートを追加して、マークダウンで文章を書いていき画像は mermaid で書いていきます。
もちろん既存のデータも追加できます。

特徴としてはそれらを自動でGitで管理しているところで、
画像の変更も抑えることができます。

また、構成をGitHub Pagesに合わせている為、それをそのまま公開することができます。

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

# UI

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
