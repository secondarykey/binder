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
  - routerを利用する
  - intlを利用する
  - スクリプトの読み込みを外部化する

- ノート 
  - ツリー構造を実現する
  - ルートをindexとして初期化
    - Binderの設定とブラウザを開くをちゃんと移行
  - 親を設定できるようにする
  - ダイアグラムは別表示(アイコン)
  - ダイアグラム、Assets は子にはなるが、どこからでもアクセスできる

- ダイアグラム
  - テンプレートを容易する
  - 表示側にパンなどを作成

- Assets をツリー表示から止める
  - ノートの編集から一覧化して管理
  - ノートに選択できるUI

- テンプレートを簡易にする
  - Layoutを固定する(一応DBに登録するか？)
  - ノートにテンプレートを登録する
  - テンプレート編集を別画面にする

