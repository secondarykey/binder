# log の TODO(レビュー待ち)

wenteasy/log の README「使う側のやり方(自分の log パッケージを作る)」と突き合わせて気付いた点。
2026-10-14、aibow のセッションで書き、2026-10-15 に wenteasy/log v0.3.3 の README に合わせて取り込んだ。

## 取り込んだもの(2026-10-15)

- **出す関数を README のひな形にした**(`log.go`)。`Info` などはメッセージ + キーと値、printf は `Infof` など。
  printf の書き方の呼び出し 117 か所を `Infof` などに書き換えた。`%` を含まない呼び出しはそのまま(どちらの形でも同じ行になる)。`window.go` の `log.Info(fn)`(変数を書式に渡していた)だけキーと値に直した。
  `Func` / `PrintTrace` / `PrintStackTrace` / `NoneStop` は変数で指したまま
- **出口を `Init(Options)` で組むようにした**(`setup.go`)。ファイルを作れなくても止めず、標準エラー出力で組んで error を返す。返す `io.Closer` は nil にしない
- **ファイル名に頭の文字を付けた**: `binder_20261015.log`。ログビューア(`Window.ReadLogTail`)は `Path()` を通しているので、そのまま追いつく
- **ログのフォルダを環境変数 `BINDER_LOG_DIR` で変えられるようにした**。無ければ今までどおり `os.TempDir()\binder`
- **`wails3 dev` ではコンソールにも出す**(`Options.Console`)。`_cmd/binder` と `_cmd/lite` の `build_dev.go` / `build_production.go` の `isDev`(`-tags production` の有無)で決める
- **dev で `-debug` が効くようにした**(dev の Info は `-debug` が無いときだけ)
- **Wails の `Options.Logger` に `slog.Default()` を渡す**ようにした(今までは `Init` が返した Logger。`Init` が失敗すると nil になり、配る exe で Wails のログが捨てられていた)
- **`settings/settings.go` の標準の `log.Println` を `binder/log` の `Warnf` にした**
- **wenteasy/log を v0.3.3 にした**(コードは doc コメントだけの違い)。`_cmd/binder` と `_cmd/lite` の go.mod にも `// indirect` で載せた
- **異常終了(拾われなかった panic)をファイルに残すようにした**(`crash.go` の `CatchCrash`。ikkyoku・aibow と同じ `debug.SetCrashOutput`)。
  Binder は複数のプロセス(Binder を 2 つ・Binder と Lite)が同じフォルダを使うので、書き出し先をプロセスごとに分けた
  (`binder_crash_pid<ID>.log`。正常に終わったら消す)。次の起動で中身のあるものを `binder_crash_<日時>.log` に改名し、ログに Warn で書く
- テストを README の「入れておく歯止め」に揃えた(位置が呼んだ側・ファイルに書かれる・フォルダを作れなくても止まらない・出し先を戻す)

## 残り

### 1. 古いログファイルを消さない

- 今: 一時フォルダの `binder\` に日ごとのファイルが溜まり続ける(OS の掃除任せ)。ikkyoku は 7 日、aibow は 10 日で消している
- 何日分を残したいかで決める。消すなら `Init` で `binder_*.log` の古いものを消す(ikkyoku の `log` にある)
- ついでに: 頭の文字の無い古いファイル(`20261014.log`)も残っている

### 2. 置き場所が一時フォルダのまま

- 一時フォルダは Windows のディスクのクリーンアップなどで消されることがある
- ふだんはログビューア(`SyslogApp.jsx`)で見るので、一時フォルダでも困らないかもしれない(ユーザーの意見)。1 と一緒に決める

### 3. 異常終了の記録を画面で伝えていない

- 今: 前回の記録があると、ログに Warn で「異常終了の記録があります: <場所>」と書くだけ(ログビューアで見える)
- aibow は画面のお知らせにも出している。出すなら、setting.json の `StartupOk` で自動オープンを止めているところと合わせて考える
- 強制終了(タスクマネージャーなど)では、空の `binder_crash_pid<ID>.log` が消されずに残る(動いている別のプロセスのものと区別できないので、起動時にも消さない)。片付けるなら 1 と一緒に、日数の経った空のものだけを消す

### 4. `multiHandler` を自前で持っている

- `slog.NewMultiHandler` は Go 1.26 から。go.mod が 1.25 なので `setup.go` に小さく書いた。go.mod を 1.26 以上にしたら置き換える

### 5. wenteasy/log の README のテストの書き方(向こうへ伝える)

- README の「テスト」は `runtime.FuncForPC(r.PC)` で位置を確かめるとあるが、引数の無い `log.Trace("t")` などはインライン展開され、
  `FuncForPC` は展開された関数(`binder/log.Trace`)を返す。ハンドラ(`AddSource`・`PackageLevelHandler`)は `runtime.CallersFrames` で引くので、
  実際に記録される位置は正しい。テストも `CallersFrames` で引くようにした(`log_test.go`)
