# log の TODO

wenteasy/log の README「使う側のやり方(自分の log パッケージを作る)」と突き合わせて気付いた点のうち、残っているもの。
取り込んだものは 2026-10-15 のコミット(`8d1ee1ab` / `e39b30f5` / `a8a76d90`)と AGENTS.md のロギングの項にある。

## 1. 置き場所が一時フォルダのまま

- 一時フォルダは Windows のディスクのクリーンアップなどで消されることがある
- ふだんはログビューア(`SyslogApp.jsx`)で見るので、一時フォルダでも困らないかもしれない(ユーザーの意見)

## 2. 異常終了の記録を画面で伝えていない

- 今: 前回の記録があると、ログに Warn で「異常終了の記録があります: <場所>」と書くだけ(ログビューアで見える)
- aibow は画面のお知らせにも出している。出すなら、setting.json の `StartupOk` で自動オープンを止めているところと合わせて考える
- 改名した異常終了の記録(`binder_crash_<日時>.log`)は片付けで消さないので、溜まり続ける(まれなので今は許す)

## 3. `multiHandler` を自前で持っている

- `slog.NewMultiHandler` は Go 1.26 から。ルートの go.mod が 1.25 なので `setup.go` に小さく書いた。ルートの go.mod を 1.26 以上にしたら置き換える
  (`_cmd/binder` と `_cmd/lite` の go.mod は 1.26 だが、`log/` はルートのモジュール)

## 4. wenteasy/log の README のテストの書き方(向こうへ伝える)

- README の「テスト」は `runtime.FuncForPC(r.PC)` で位置を確かめるとあるが、引数の無い `log.Trace("t")` などはインライン展開され、
  `FuncForPC` は展開された関数(`binder/log.Trace`)を返す。ハンドラ(`AddSource`・`PackageLevelHandler`)は `runtime.CallersFrames` で引くので、
  実際に記録される位置は正しい。テストも `CallersFrames` で引くようにした(`log_test.go`)
- v0.3.3 の README はまだ `FuncForPC` のまま
