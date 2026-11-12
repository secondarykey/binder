# 構造の改善（残っている作業）

2026-11-12 にリポジトリ全体の構造を見直し、気になった点を 7 件挙げた。
そのうち済んだものと、残っているものをここにまとめる。**別のセッションで続きを行うための引き継ぎ**。

数字（行数・件数）は 2026-11-12 時点のもの。着手する前に、書いてあるコマンドで測り直すこと。

## 済んだもの

| 内容 | コミット |
|---|---|
| Lite から db / fs の依存を外す（バイナリ 27.2MB → 19.2MB）。既定アセットの配置を `setup/defaults` に分け、ライセンス文はフロントのビルドで取り込む | `1ebee0f6` `eff70d8b` |
| `api/git.go` の中身を `binder.Repository`（`repository.go`）へ移す（1316 行 → 799 行） | `bae6aa48` |
| `_cmd` と `_cmd/gen` の go.mod をルートに揃える。DAO 生成の出力先を go.mod の位置で決める。ビルドできない `_cmd/git.go` を消す | `cb320030` `bef103ac` `4ea6b798` |
| ルートの残骸（`fonts.go` / `editor.go`）の片付け。同梱の marked / mermaid を `_cmd/shared/frontend/vendor/` の 1 組にまとめる | `2c547cd6` `54420f66` |
| エディタの `Component.jsx` から部品・フック・関数を切り出す（3230 行 → 2119 行） | `3b7d659d` |
| AGENTS.md の記述を実体に合わせる | `d689c1e7` |
| 閉じて開き直す操作（`api.App.runClosed`）と、それを通る API のテスト（`api/closed_test.go`） | `ac47ddff` |
| リモートからの取り込みと、取り込み元のバージョンの確認・その場での移行のテスト（`repository_merge_test.go`・`api/closed_test.go`） | `bfbc4994` |
| `fs` から `db` と `settings` への依存を外す（CSV のファイル名は fs が持つ・署名の既定値は `fs.SetDefaultUser` で渡す） | `112ef29e` |
| バインダーの中身の型を `binder/entity` へ移し、`db/model`・`db`・`fs`・`setup` の `api/json` への依存を外す | `63252a20` |
| gofmt の掛かっていなかった 12 ファイルの整形。Vite / Vitest の設定の警告（`__dirname`・無視されていた `esbuild.jsx`） | `6527e7b6` `ae1ff372` |
| ルート・`_cmd`・`_cmd/gen` の `go` ディレクティブを 1.26.0 に揃える。`log/` の自前の `multiHandler` を `slog.NewMultiHandler` に置き換える | `cca490ad` |
| エディタの `Component.jsx` からダウンロード・プレビューの生成・公開・テンプレートのプレビュー対象を切り出す。本文への挿入を 1 つにまとめる。`Mode` を `src/mode.js` に分ける（2210 行 → 1798 行） | `a7335500` |
| エディタの `Component.jsx` から、開いているものの読み込みとプレビューを作るタイミングを `useEditorDocument` に切り出す（1798 行 → 1480 行） | `cbea3ee8` |

## 先にやること: 実機での確認

上の変更は、テストとビルドでしか確かめていない。
**アプリを起動して画面を触る確認はしていない**ものを、ここに並べる。問題が出たら、残りの作業より先に直す。

チェックの入っているものは 2026-11-12 に確かめた。入っていないのは、「閉じて開き直す操作」（取り込みなど。
手間が掛かるので後回しにした。D とは触る場所が重ならない）と、最後に行った D の切り出し（`cbea3ee8`）の分。

Lite / ライセンス:

- [x] Binder と Lite の設定画面で、ライセンスとサードパーティライセンスの文が表示される
- [x] Lite が起動し、テーマ・言語・プレビューが今までどおり動く（`~/.binder` の `_default/` が更新される）
- [x] macOS / Linux でビルドできる（アセットのパスを `setup/defaults/_assets/` に変えた）

閉じて開き直す操作（`api.App.runClosed`。`api/closed_test.go` でテストした。リモートは bare リポジトリ相手なので、
実際のサーバとの認証つきの送受信と、画面の表示・開き直したあとの画面の更新は実機でしか確かめられない）:

- [ ] 取り込み（他ブランチから / リモートから）: 早送り・衝突なし・衝突ありの 3 通り
- [ ] 衝突の解決を選んで適用する。取り込みログのノートができる
- [ ] 履歴からの復元、ブランチの作成・切替、履歴の整理（圧縮）、不要データの削除
- [ ] バインダーを開いていない状態での履歴表示・復元・ブランチ切替（`*ByPath`）

エディタ:

- [x] スプリッター 2 本のドラッグ（ツリー幅・エディタ幅）
- [x] Ctrl+Shift+O（スニペット）と Ctrl+T（ID 挿入）で、メニューがカーソルの位置に出る
- [x] アウトライン・囲み・書式ボタン・表の編集
- [x] ダイアグラムのプレビューの、中ボタンでの移動とホイールでの拡大
- [x] 編集側の「その他」メニューからのテキストのダウンロード（そのまま / 展開済み）
- [x] テンプレート編集時の、プレビュー対象の選択と、開き直したときの前回の選択の復元
- [x] プレビュー側の「その他」メニュー（別ウィンドウ・公開・ブラウザで開く・非公開）

エディタ（D の切り出し `a7335500` のあと。テストは 105 ファイル 515 件。上と同じところをもう一度触ることになる）:

- [x] ノート・図・テンプレート（layout / content / diagram）を開き、プレビューが出る。入力してしばらくするとプレビューが変わる
- [x] ノートからノート・図から図へ切り替えても点滅しない。切り替えたあとカーソルとスクロールが先頭に戻る
- [x] 空のノート・書式の誤った図で、ステータスバーがエラーになり、エラー行が赤くなる
- [x] 本文への挿入: スニペット・ID 挿入・囲み・書式ボタン・オートコンプリート（`{{` と ID の `"`）・
      検索の置換と全置換・ツリーからの挿入（アセットのドロップ）。入れたあと Ctrl+Z で戻せる
- [x] ダウンロード（SVG / HTML・そのまま・展開済み・zip）
- [x] 公開（参照先を一緒に公開するダイアログが出る場合も）・非公開（確認ダイアログ）・ブラウザで開く
- [x] テンプレートを編集するとき、プレビューの相手（ノート・もう一方のテンプレート・図）を選び直せ、開き直すと前の選択に戻る
- [x] 別ウィンドウのプレビューが、開いた直後と編集のたびに更新される

エディタ（読み込みとプレビューのタイミングの切り出し `cbea3ee8` のあと。テストは 105 ファイル 523 件。
`useEffect` を別のフックへ移したので、開く・切り替える・入力するときの動きをもう一度見る）:

- [ ] ノート・図・テンプレート・アセット・レイヤーを順に開き、種類をまたいで切り替える（ノート → 図 → テンプレート → アセット → ノート）。
      エディタとプレビューの出方、タイトル、記録ボタンの強調が合っている
- [ ] ノートからノート・図から図へ切り替えても点滅しない。切り替えたあとカーソルとスクロールが先頭に戻る
- [ ] 入力中はプレビューが少し遅れて変わり、スニペットなどの挿入ではすぐ変わる。カーソル行にプレビューが付いてくる
- [ ] テンプレート（layout / content / diagram）を開いた直後にプレビューが出る。相手を選び直すと変わる
- [ ] 履歴から復元したあと、開いているノートの本文とプレビューが復元後のものになる
- [ ] 外部エディタで編集して保存すると、本文とプレビューが変わる
- [ ] 別ウィンドウのプレビューが、開いた直後・切り替え・編集のたびに更新される

## 残っている作業

A〜E はすべて済んだ（E の `__tests__` の平置きは見送り）。残っているのは、D の末尾に書いた小さなものだけ。

### A. 下の層が `api/json` に依存している → 済み

`db/model`・`db`・`fs`・`setup` は `api/json` を import しなくなった（テスト以外。残るのはルートと `api` 配下）。

```bash
# 誰が import しているか（ルートの *.go だけが出る）
grep -rln '"binder/api/json"' --include=*.go . | grep -v _test | grep -v '^./api/'
```

どうしたか:

- 新しいパッケージ `binder/entity`（`entity/`）へ、`Note` / `Diagram` / `Asset` / `Layer` / `Template` / `Structure`、
  `Status` と定数、`TemplateType` と定数、`ErrorPageAlias` / `IsErrorPageAlias` を移した。`entity` は他の binder パッケージを
  import しない
- `api/json/entity.go` に同じ名前の**型エイリアス**と定数を置いた。`api` とルートは今までどおり `json.Note` と書ける。
  JSON のフィールド名は変えていない
- `db/model`・`db`・`fs`・`setup` は `entity` を直接使うように書き換えた

決めたこと・分かったこと:

- **ルートは書き換えていない**。ルートは `json.Leaf` / `json.Tree` / `json.Config` / `json.UserInfo` / `json.PublishRef` など
  画面向けの型も作って返すので、`api/json` の import は残る。`entity.Note` と `json.Leaf` を 1 つのファイルに混ぜるより、
  「api とルートは `json.Xxx`、下の層は `entity.Xxx`」と層で分けた方が読みやすいと判断した。
  ルートの `api/json` への依存（層の図と逆向き）自体は残っている。無くすなら、ルートが返す画面向けの型
  （`Tree` / `Leaf` / `Config` など）の置き場所から考え直すことになる
- **エイリアスは消さない**（当初の案の 4）。`api` とルートが使っている
- **Wails のバインディングは型エイリアスを扱える**。生成すると実体は `bindings/binder/entity/models.js` に出て、
  `bindings/binder/api/json/models.js` は `export const Note = entity$0.Note;` のように同じ名前で出し直す。
  `app.js` の関数の数（203）は変わらない。フロントのソースはどちらも直接 import していない。
  生成し直したうえで、フロントのテスト（102 ファイル 490 件）と `vite build` が通ることを確かめた
- テストのファイルには `api/json` の import が残っているものがある（`setup/initialize_test.go` の `json.Leaf`）。
  ツリーを見るためで、問題ない

### B. `fs` が `db` と `settings` に依存している → 済み

`fs` が import する binder パッケージは `binder/log` と `binder/entity` だけになった（`api/json` は A で `entity` に替わった）。

```bash
go list -f '{{join .Imports "
"}}' ./fs | grep ^binder
```

どう外したか（当初の案と違うところがある）:

- `db` の方: テーブル名の一覧を渡す形にはせず、**CSV のファイル名を `fs/db.go` が定数で持つ**ようにした。
  `fs.NoteTableFile()` などはパッケージの関数で 50 か所ほどから呼ばれており、渡す形にすると全部を
  `FileSystem` のメソッドへ書き換えることになる。fs はもともとバインダーの中のファイルの置き場所を決めている
  （`notes/` や `db/`）ので、CSV のファイル名もその一部として持たせた。db 側（`db.Tables()`）と同じ名前を
  2 か所に書くことになるので、揃っていることをルートの `table_files_test.go` で確かめている。
  テーブル名の定数を `binder/entity` へ置けば 1 か所にまとめられるが、DAO の生成（`_cmd/gen`）が `db.XxxTableName` を
  出しているので、そちらも変えることになる（やっていない）
- `settings` の方: バインダーごとの署名が無いときの名前とメールを取る関数を `fs.SetDefaultUser` で渡す。
  渡しているのは `setup/signature.go` の `init`（ルートではなく setup にしたのは、バインダーを作る `setup.Install` も
  ユーザ署名で記録するため。ルートは setup を import するので、どちらの経路でも記録の前に設定される）。
  **setup を import せずに fs だけで記録するプログラムを書くと、署名の名前とメールが空になる**
  （いまは無い。`_cmd` で fs を使うのは setup も使う `_cmd/binder` だけ）

### C. `api` に残っている `fs` の直接利用

**いまの状態**: `api/git.go` から `fs.Load` は無くなったが、`api` はまだ `fs` を import している。

```bash
grep -c '\bfs\.[A-Z]' api/*.go | grep -v ':0'
```

| ファイル | 件数 | 中身 |
|---|---|---|
| `api/git.go` | 11 | `fs.UserInfo` への詰め替え、`fs.ListRemoteBranches`、`fs.FileResolution` / `fs.MergeLog` / `fs.CommitInfo` などの型 |
| `api/error.go` | 5 | `fs` の sentinel エラーをユーザ向けのメッセージに対応させている |
| `api/binder.go` | 4 | `holdOpen`（`fs.AcquireOpen` / `fs.ReleaseOpen`）ほか |
| `api/plugin.go` | 4 | 未調査 |
| `api/rootfile.go` / `setting.go` / `setup.go` | 各 2 | 未調査 |

**やる価値があるもの**:

- ~~`runClosed` のテスト~~ → 済み（`api/closed_test.go`）。成功・操作の失敗（`error`）・開き直しの失敗（`reload_error`）、
  「開いている」印が操作の間も残ること、ブランチの作成・切替、ローカルブランチからの取り込み（早送り・衝突なし・
  衝突ありと解決の適用・取り込みログのノート）、復元、履歴の整理、不要データの削除、未記録の変更があるときに
  断ること、開いていないバインダー向けの `*ByPath` を見ている。
  テストで差し替えたのは設定の保存先だけ: `LoadBinder` が履歴を `setting.json` へ保存するので、`TestMain` で
  `USERPROFILE`（Windows 以外は `HOME`）を一時ディレクトリへ向けてから `settings.EnsureDir()` を呼ぶ
  （`settings.Home()` が読む環境変数。`settings` のテストと同じ切り替え方）。HTTP サーバは遅延起動なので触らない。
  見ていないもの: `WindowCloser` の呼び出し、認証情報の保存（`save` が true）
- ~~リモートからの取り込み・取り込み元の移行のテスト~~ → 済み（`repository_merge_test.go`、api 側は `api/closed_test.go`）。
  リモートは `git.PlainInit(dir, true)` で作った bare リポジトリのパスを `origin` にしている（ネットワーク無し）。
  見ているのは、リモートからの早送り・すでに最新・衝突と解決の適用（取り込みログにリモート名が入る）、
  取り込み元がアプリより新しい（`MergeVersionNewer`。何も書き込まない）、古すぎる（エラー。何も書き込まない）、
  古いのでその場で移行する（移行後は元のブランチへ戻り、取り込み元のブランチは動かない）。
  書くときに分かったこと:
  - ディレクトリ相手でも `fs.UserInfo.AuthType` が空だと `authMethod` がエラーにする。テストでは `basic` を入れている
  - 送信（go-git の Push）はリモート追跡の参照（`refs/remotes/origin/<ブランチ>`）も進める。
    「取ってくる前は取り込めない」を確かめるには、送ったあとその参照も消す
  - 移行のテストは、いまのスキーマのバインダーの `binder.json` のバージョンだけを `0.10.1` に書き換えた取り込み元で
    行っている（掛かるのは 0.10.2 の移行だけで、CSV は実質変わらない）。**本当に古いスキーマの CSV を移行して
    取り込む経路は見ていない**。見るなら古い版のバインダーのひな形が要る

**やらなくてよさそうなもの**: `fs.UserInfo` などの型や sentinel エラーを `api` から見えなくすること。
型の詰め替えは api の仕事で、`fs` の import を 0 にすること自体に意味は薄い。

### D. エディタ本体（`Component.jsx`） → 済み

**いまの状態**: 1480 行。`useState` が 36、`useRef` が 11、`useEffect` が 20 ある（`cbea3ee8` のあと）。
残っているのは、画面の組み立て（JSX と `useStableHandlers` で約 300 行）、入力の処理（キー操作・貼り付け・挿入・検索と置換）、
設定の同期（フォント・行番号・折り返しなど）、カーソル位置の ID と関数ヒントの検出。
構成は `_cmd/binder/frontend/AGENTS.md` の「components/editor/」を参照。

```bash
cd _cmd/binder/frontend/src/components/editor
wc -l Component.jsx; grep -c '= useState(' Component.jsx; grep -c '= useRef(' Component.jsx; grep -c 'useEffect(() =>' Component.jsx
```

**切り出したもの**（`a7335500` で 1・2・3・5 と 4 の一部、`cbea3ee8` で 3 + 4 をまとめた `useEditorDocument`）:

| 当初の番号 | どうしたか |
|---|---|
| 1. ダウンロード | `useEditorDownloads.js`。値を受けて関数を返すだけ |
| 2. 公開 | `useEditorPublish.jsx`。公開・非公開・ブラウザで開くと、そのダイアログ（`dialogs` で返し、本体が描画に置く） |
| 3. プレビューの生成 | `useEditorPreview.js`。`parseText` / `createMarked` / 図・テンプレートの描画。`html` と `parseStatus` はここが持つ |
| 4. 開いたときの初期処理 | `useEditorDocument.js`。種類ごとの関数（`openNote` / `openDiagram` / `openTemplate` / `openWithoutEditor`）と `useEffect([id, restoredAt])`。テンプレートのプレビューの相手（一覧と選択）は `useTemplatePreviewTargets.js` |
| 3 + 4. 読み込みとプレビュー | `useEditorDocument.js` が、`text` / `name` / `updated` / `isPrivate` / `alias` / `styleTemplateId` / `templateType` と、いつプレビューを作るか（`useEffect([text, openSeq])`）を持つ。`useEditorPreview` と `useTemplatePreviewTargets` はこの中で使う |
| 5. テキストへの挿入 | 本体の `insertIntoEditor(str, range)` の 1 つにまとめた（スニペット・書式・置換・全置換・オートコンプリート・`InsertText` のイベント） |

決めたこと・分かったこと:

- **`useEffect` の並び**。`a7335500` では 1 つも動かさず、`cbea3ee8` で 7 つを `useEditorDocument` へ移した
  （開く・テンプレートのプレビュー 4 つ・本文が変わったとき・開き終えたとき）。**移した 7 つ同士の並びは変えていない**。
  本体では、`modeRef` / `idRef` を合わせる `useEffect` のすぐ後ろでフックを呼ぶ（読み込みが `idRef` を見るため、これより前に置かない）。
  本体に残った `useEffect` との前後は一部入れ替わった: 開く処理が、`nameRef` の同期・オートコンプリート・Ctrl+F と Alt+← の購読・
  配色の取得より前になり、本文が変わったときの処理が、検索の自動オープン・各種の設定の購読・名前が変わったとき（タイトルの更新）より前になった。
  どれも ref の同期・購読・設定の取得で、移した 7 つが見る ref（`loadingRef` / `fileOpeningRef` / `isEditingRef` /
  `parseTimerRef` / `diagramInitializedRef`）にも `text` にも触らないので、互いに依存しない
- **入力中としての差し替えは `editText` を通す**。`isEditingRef` は `useEditorDocument` の中だけのものにし、
  本体（打鍵・貼り付け・Enter / Tab / Ctrl+B などのキー操作）は `editText(txt)` を呼ぶ。すぐプレビューを作り直すとき（挿入・外部エディタ）は `setText`。
  `loadingRef` は本体にも返している（読み込み中の入力と挿入を止めるため）
- **`insertIntoEditor` は、開いている途中（`loadingRef` が立っている間）は入れない**。これだけは挙動を変えた。
  ノートを切り替えた直後は、読み終えるまで前の本文を出したままにしている。その間にツールバーなどから挿入すると、
  前の本文に入れた内容が**新しく開く側の ID で保存される**（打鍵は `handleChangeText` が同じ理由で止めていたが、
  挿入は止めていなかった）。保存先も、次のフレームではなく入れた時点の mode / id にしている。
  読み込みに失敗したまま（`loadingRef` が立ったまま）だと挿入もできないが、打鍵と同じ扱い
- 貼り付け（`handlePaste`）・表の編集（`handleTableClose`）・Enter / Tab / Ctrl+B などのキー操作は、
  `insertIntoEditor` に寄せていない。貼り付けとキー操作は入力中の扱い（`isEditingRef` を立ててデバウンス）で、
  表の編集は `textarea.value` を直接書き換えてから 500ms 待つ（ダイアログが閉じるのを待っていると思われる。
  元に戻す（Ctrl+Z）の対象にならない）。揃えるなら実機で確かめながら
- `HTMLFrame` に渡す props の繰り返しは、`frameProps` にまとめた
- `Mode` は `src/mode.js` に分けた（`app/App.jsx` からも同じものを export している）。import していたのは
  `Component.jsx` / `useEditorCandidates.js` / `editor-save.js` の 3 ファイルだった。
  **`Component.jsx` は `copyClipboard` のためにまだ App.jsx を import している**ので、循環（App → Content → Component → App）は
  残っている。`copyClipboard` は 5 ファイルが使い、8 つのテストが `vi.mock('../app/App', ...)` で差し替えているので、
  動かすならテストも一緒に書き換える

**残っているもの**（どれも急がない）:

- `Component.jsx` は `copyClipboard` のためにまだ App.jsx を import している（上に書いた循環）
- `EditorComponent.test.jsx` の `vi.mock('../../../bindings/binder/api/app', ...)` はパスが 1 段多く、
  効いていない（正しくは `'../../bindings/...'`）。いまは実物のバインディングが `Call.ByID` のモック経由で
  動いている。直すと、モックに無い関数（`GetEditor` など）を足す必要が出る。
  `EditorHooks.test.jsx`（切り出したフックのテスト）は正しいパスで差し替えている
- 貼り付け・表の編集・キー操作を `insertIntoEditor` に寄せること（上に書いたとおり、扱いが違う）
- さらに分けるなら、設定の同期（`GetEditor` / `GetFont` と `binder:editor:*` の購読、`saveEditorSetting`）と、
  カーソル位置の検出（`detectIdAtCursor` / `detectFuncHint`）が次の候補。どちらも読み込みとは絡まないので、
  `useEditorDocument` よりは切りやすい。ただし設定の同期は `setViewer` を通して開く処理とつながっている
  （アセット・レイヤーではプレビューを出さない）

### E. 小さなもの

- ~~`go` ディレクティブの不揃い~~ → 済み。5 つの go.mod すべてが 1.26.0（README の前提条件はもともと Go 1.26+）。
  `log/TODO.md` にあった `slog.NewMultiHandler` への置き換えも行った
- ~~gofmt が掛かっていないファイル~~ → 済み。`gofmt -l . | grep -v node_modules` は 0 件
- **`__tests__` の平置き**（約 100 ファイル）。`app` / `dialogs` / `components` の区分と対応していない。
  動かすと相対 import と `vi.mock` のパスが全部変わる。得るものが見た目の整理だけなので、**見送ってよい**
- ~~Vite の警告~~ → 済み。`vite.config.js`（Binder・Lite）と `vitest.config.js` の `__dirname` を `import.meta.dirname` にし、
  `vitest.config.js` の `esbuild: { jsx: 'automatic' }` を消した。`import.meta.dirname` は Node 20.11 以降で使える
  （CI は 22）。ビルドに残る警告は、チャンクの大きさ（500 kB 超）のものだけ

## 作業するときの注意（今回つまずいたこと）

- **ワークツリーで生成・書き換えをするスクリプトは、出力先を先に確かめる**。ワークツリーは
  メインのチェックアウトの下（`binder/.claude/worktrees/<名前>`）にあるので、「上へたどって名前で探す」作りの
  ツールはメイン側を書き換える。`_cmd/gen` はこれでメイン側の `db/*_dao.go` を書き換えた（直した）。
  動かしたあとはメイン側の `git status` も見る
- **`vite build` が失敗すると `frontend/dist` が空になる**。`_cmd/binder` と `_cmd/lite` は
  `//go:embed all:frontend/dist` なので、空のままだと Go のビルドと `go list` が通らない。作り直す
- **バインディングは古いことがある**。ワークツリーに `bindings/` があっても、API を足したあとに
  生成し直していなければビルドで「is not exported」になる。`cd _cmd/binder && wails3 generate bindings -f '' -clean=true`
  （Lite も `_cmd/lite` で同じ）
- **バンドラは未定義の変数を検出しない**。大きなコンポーネントを分けたときは、`vite build` が通っても
  参照切れが残りうる。eslint は入っていないが `@babel/parser` と `@babel/traverse` が `node_modules` にあるので、
  スコープ解析（`path.scope.globals`）で未定義の参照を調べられる
- **Lite に入れてよい binder パッケージ**は `log` / `settings` / `api/lite` / `api/shared` / `setup/defaults` だけ。
  import を足したら `cd _cmd/lite && go list -deps . | grep ^binder` で確かめる（`_cmd/lite/AGENTS.md`）
- **Vite の `?raw` で親ディレクトリのファイルを読むとき**、`server.fs.allow` はファイル単位では効かない
  （`?raw` 付きの ID も照合されるため）。ディレクトリで許可する。dev サーバと vitest の両方に要る
