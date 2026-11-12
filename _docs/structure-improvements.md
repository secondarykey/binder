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

## 先にやること: 実機での確認

上の変更は、テスト（Go 全パス・フロント 102 ファイル 490 件）とビルドでしか確かめていない。
**アプリを起動して画面を触る確認はしていない**。残りの作業に入る前に、次を一度動かしておく。
ここで問題が出たら、残りの作業より先に直す。

Lite / ライセンス:

- [ ] Binder と Lite の設定画面で、ライセンスとサードパーティライセンスの文が表示される
- [ ] Lite が起動し、テーマ・言語・プレビューが今までどおり動く（`~/.binder` の `_default/` が更新される）
- [ ] macOS / Linux でビルドできる（アセットのパスを `setup/defaults/_assets/` に変えた）

閉じて開き直す操作（`api.App.runClosed`。`api/closed_test.go` でテストした。リモートは bare リポジトリ相手なので、
実際のサーバとの認証つきの送受信と、画面の表示・開き直したあとの画面の更新は実機でしか確かめられない）:

- [ ] 取り込み（他ブランチから / リモートから）: 早送り・衝突なし・衝突ありの 3 通り
- [ ] 衝突の解決を選んで適用する。取り込みログのノートができる
- [ ] 履歴からの復元、ブランチの作成・切替、履歴の整理（圧縮）、不要データの削除
- [ ] バインダーを開いていない状態での履歴表示・復元・ブランチ切替（`*ByPath`）

エディタ:

- [ ] スプリッター 2 本のドラッグ（ツリー幅・エディタ幅）
- [ ] Ctrl+Shift+O（スニペット）と Ctrl+T（ID 挿入）で、メニューがカーソルの位置に出る
- [ ] アウトライン・囲み・書式ボタン・表の編集
- [ ] ダイアグラムのプレビューの、中ボタンでの移動とホイールでの拡大
- [ ] 編集側の「その他」メニューからのテキストのダウンロード（そのまま / 展開済み）
- [ ] テンプレート編集時の、プレビュー対象の選択と、開き直したときの前回の選択の復元
- [ ] プレビュー側の「その他」メニュー（別ウィンドウ・公開・ブラウザで開く・非公開）

## 残っている作業

手を付ける順の目安は「小さく確実なもの → 効果の大きいもの」。D と E は独立しているので、どれからでもよい（A・B・C は済み）。

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

### D. エディタ本体（`Component.jsx`）の残り

**いまの状態**: 2119 行。`useState` が 53、`useRef` が 17、`useEffect` が 27 ある。
残っているのは、開く・変換してプレビューする・保存する・公開する、の流れ。
構成は `_cmd/binder/frontend/AGENTS.md` の「components/editor/」を参照。

**なぜ残したか**: `text` / `parseStatus` / `html` と、`loadingRef` / `fileOpeningRef` / `isEditingRef` /
`parseTimerRef` / `diagramInitializedRef` などの ref が、複数の `useEffect` をまたいで順序に依存している
（非同期ロードの競合対策・入力中のデバウンス・開いた直後のカーソル位置など）。
テストは「描画できる」と「部品につながっている」だけなので、**動かして確かめずに分けると壊す**。

**分けるなら、切りやすい順**:

1. **ダウンロード**（`handleDownload` / `handleDownloadRaw` / `handleDownloadExpanded` / `handleDownloadZip`）。
   読むのは `mode` / `id` / `name` / `text` / `html` だけで、状態を書かない。`useEditorDownloads` に出せる
2. **公開**（`handlePublish` / `doUnpublish` / `handleOpenInBrowser` と `unpublishConfirm` の状態）。
   `createMarked` を使うので、3 のあとの方が切りやすい
3. **プレビューの生成**（`parseText` / `createMarked` / `viewHTML` / `viewDiagram` /
   `viewDiagramTemplatePreview`）。`setParseStatus` / `setHTML` と `#mermaidViewer` の DOM を直接触る。
   フックにして `{ html, parseStatus, parseText }` を返す形が素直だが、4 と絡む
4. **開いたときの初期処理**（`useEffect(..., [id, restoredAt])` の約 220 行。種類ごとの分岐）。
   種類ごとの関数に分けるだけでも読みやすくなる。状態のセッターを 15 個ほど使うので、
   フックに出すなら 3 と一緒に「読み込みとプレビュー」としてまとめて出す
5. **テキストへの挿入**。`textarea.focus()` → `setSelectionRange` → `document.execCommand('insertText', ...)` →
   次フレームで `setText` と `saveText`、という同じ形が 8 か所ほどある
   （`handleInsertSnippet` / `handleInsert` / `handleReplace` / `handleAutocompleteSelect` / `InsertText` のイベントなど）。
   `insertAtSelection(textarea, text)` のような 1 つの関数にまとめると、行数が減り、挙動も揃う。
   **これは 1〜4 と独立にできる**

**そのほか、エディタまわりで気付いたこと**:

- `EditorComponent.test.jsx` の `vi.mock('../../../bindings/binder/api/app', ...)` はパスが 1 段多く、
  効いていない（正しくは `'../../bindings/...'`）。いまは実物のバインディングが `Call.ByID` のモック経由で
  動いている。直すと、モックに無い関数（`GetEditor` など）を足す必要が出る
- `Mode` は `app/App.jsx` にあり、`Component.jsx` / `useEditorCandidates.js` / `editor-save.js` など 9 ファイルが
  App.jsx を import している（App → Content → Component → App の循環）。実行時は問題になっていないが、
  `Mode` を小さなモジュール（たとえば `src/mode.js`）に出すと循環が切れ、部品のテストも軽くなる
- `HTMLFrame` に渡す props が、ノート用とテンプレート用の 2 か所でほぼ同じ内容を繰り返している

### E. 小さなもの

- **`go` ディレクティブの不揃い**。`_cmd/binder`・`_cmd/lite` は 1.26.0、ルート・`_cmd`・`_cmd/gen` は 1.25.0、
  CI は `.github/variables` の `GO_VERSION`（1.27）。ルートを 1.26 に上げると、`log/TODO.md` にある
  `slog.NewMultiHandler` への置き換えも一緒にできる。上げるかどうかは判断が要る（利用者のビルド環境に効く）
- **gofmt が掛かっていないファイル**が 12 個ある（今回の変更とは無関係。差分が混ざるので別コミットで）
  ```bash
  gofmt -l . | grep -v node_modules
  ```
- **`__tests__` の平置き**（約 100 ファイル）。`app` / `dialogs` / `components` の区分と対応していない。
  動かすと相対 import と `vi.mock` のパスが全部変わる。得るものが見た目の整理だけなので、**見送ってよい**
- **Vite の警告**。`vite.config.js` / `vitest.config.js` の `__dirname` が将来の `configLoader: 'native'` で
  使えなくなる（`import.meta.dirname` へ）。`vitest.config.js` の `esbuild: { jsx: 'automatic' }` は
  oxc の設定があるため無視されている

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
