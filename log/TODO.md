# log の TODO(レビュー待ち)

wenteasy/log の README「使う側のやり方(自分の log パッケージを作る)」(v0.3.2〜)と突き合わせて気付いた点。
2026-10-14、aibow のセッションで書いた。**直すかどうか・どう直すかは binder 側でレビューして決める**(ここに書いたのは材料だけ)。

binder の `log/` は wenteasy/log ができる前のたたき台を、あとから wenteasy/log に寄せたもの。

## 気付いた点

### 1. `Info` などが printf の形

- 今: `log.Info` / `log.Warn` などは `wlog.Infof` などを変数で指していて、printf の形(`log.Warn("失敗:\n%+v", err)`)
- README: `Info` は slog と同じ「メッセージ + キーと値」、printf は `Infof`
- 何が起きるか: README を読んだセッションが binder で `log.Info("保存しました", "path", p)` と書くと、
  `保存しました%!(EXTRA string=path, …)` のような壊れた行になる。セッションごとに書き方がばらつく原因になる
- 規模: `log.` の出す関数の呼び出し 130 か所のうち、文字列に `%` を含む printf の書き方が 116 か所(`.claude` の下を除く。2026-10-14 時点)
- 揃えるなら: 出す関数を README のひな形(自前の `output`)にし、printf の呼び出しを `Infof` / `Warnf` などに書き換える。
  `Func` / `PrintTrace` / `PrintStackTrace` / `NoneStop` は今の変数で指す形のままでよい(位置はずれない。`NoneStop` は包むと recover が効かない)
- 揃えないなら: binder の AGENTS.md に「binder の `log.Info` は printf の形(README と違う)」と強めに書いておく(今も書いてある)

### 2. ファイルの置き場所が一時フォルダ

- 今: `os.TempDir()\binder\20261014.log`
- aibow: `%APPDATA%ibow\logsibow_<日付>.log`。ikkyoku は binder と同じ一時フォルダ（`%TEMP%\ikkyoku`。7 日で消す）。
  README は「置き場所はアプリで決める」（wenteasy/log `444a65e`。何日分を残したいか、どこで見るかで決める）
- 気になる点: 一時フォルダは、Windows のディスクのクリーンアップなどで消されることがある
- ただし: binder は自分のログビューア(`SyslogApp.jsx`。`Window.ReadLogTail` が `log.Path()` を読む)を持っていて、
  ふだんはそこで見るので、一時フォルダでも困らないかもしれない(ユーザーの意見)。何日分を残したいかで決める
- ついでに: ファイル名に頭の文字が無い(`20261014.log`)。`w.SetPrefix("binder")` で `binder_20261014.log` になる。
  変えると `ReadLogTail` の読む場所も変わる(`Path()` を通しているので、コードはそのままで追従するはず)

### 3. `wails3 dev` でターミナルに何も出ない

- 今: `Init` は常にファイルだけに書く
- README: 開発中(`wails3 dev`・`go run`)はコンソールにも出す(`Options{Console: true}`)
- ログビューアで見られるなら不要かもしれない。ターミナルでも見たいかで決める

### 4. dev のときに `-debug` が効かない

- `_cmd/binder/main.go`: `-debug` なら `log.SetLevel(slog.LevelDebug)`(57 行目付近)、
  そのあと dev なら `log.SetLevel(slog.LevelInfo)`(84 行目付近)。dev で `-debug` を付けても Info に戻る
- 意図したものか確認する。意図していないなら、dev の Info は `-debug` が無いときだけにする

### 5. 標準の `log` を直接使っている

- `settings/settings.go` が標準の `log.Println` を使っている(320・328 行目付近)
- `slog.SetDefault` のあとなら標準の `log` も slog の出口に流れるので、同じファイルには入る(レベルは Info)
- README:「プロジェクトのコードは自分の log から出す」。`binder/log` に置き換えるか決める

### 6. wenteasy/log の版

- `go.mod` は v0.3.1。v0.3.2 にすると、モジュールのキャッシュの README に「使う側のやり方」が入る(コードの変更は無い)

## そのままでよいと思った点

- 出す関数を変数で指す形なので、記録される位置はずれていない
- binder はアプリだけなので、`SetLogger` が無いのは README の決まりどおり
- ログのレベル(`SetLevel` / `GetLevel`。画面から変える)を `binder/log` が持つのは、アプリ側の状態なので問題ない
- `Init` が返す Logger を Wails の `Options.Logger` に渡しているので、Wails のログも同じファイルに入る
- `_cmd/lite` も同じ `log.Init()` を使う。2・3 を変えるなら一緒に変わる
