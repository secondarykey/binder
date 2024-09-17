# binder

[!CAUTION]
There is still only an experimental implementation

binder is markdown editor.

# Why?

I wanted to write technical texts in text format, so I wanted to create an editor that could be used exclusively for it.

# use

- marked
- mermaid
- go-git
- wails(template react)
- vim.js

# スキーマ変更に伴い注意すること

- 技術的
  - intlを利用する
  - スクリプトの読み込みを外部化する

- ノート 
  - ルートをindexとして初期化
    - Binderの設定とブラウザを開くをちゃんと移行

- ダイアグラム
  - テンプレートを容易する
  - 表示側にパンなどを作成

- Assets をツリー表示(ただし非表示にする)

- テンプレートを簡易にする
  - テンプレート編集(ツリー)を別画面にする
