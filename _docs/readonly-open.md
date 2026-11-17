# 読み取り専用で開く（別の Binder が開いているバインダー）

別の Binder がバインダーを開いているとき（`.git/binder-open.lock` がロックされているとき）、
今は `fs.ErrOpenedElsewhere` で開けず、メッセージ（`go.error.openedElsewhereNamed`）を出すだけになっている。
これを、**見るだけなら開ける**ようにする。

この文書は設計で、実装はまだ。利用者と決めたことは最後の「決めたこと」にある。

## 目的と範囲

- 書き込まずに開いて、ツリー・ノート・図・アセット・プレビュー・検索・履歴を見られるようにする
- 書き込みは**どこからもできない**ようにする。画面で隠し忘れたボタンがあっても、Go 側で必ず止める
- 範囲外:
  - 相手の Binder が書き換えた内容をその場で反映すること（手で読み直す）
  - ロックが掛かっていないバインダーを、あえて読み取り専用で開くこと（後で入口を足すのは簡単）
  - Binder Lite（バインダーを扱わない）

## 今、開くときに書き込んでいるもの

`binder.Load()`（`binder.go`）と、その前にフロントが呼ぶ `CheckCompat` / `Convert` は、開くだけで次のものを書き込む。
読み取り専用ではこれらを**すべて飛ばす**。

| 書き込み | 場所 | 読み取り専用では |
|---|---|---|
| 「開いている」印（ロック + `binder-open.json`） | `fs.AcquireOpen`（`fs/openmark.go`） | 取らない。`Close` でも外さない |
| gitインデックスの自動復旧 | `fs.Load` → `repairIndexIfCorrupt`（`fs/index_recovery.go`） | しない。**相手が書いている途中の index を壊れていると見て書き直すと、本当に壊す** |
| `docs/` が無ければ作る | `binder.Load` の `os.MkdirAll` | 作らない（無ければ公開済みが無いだけ） |
| スキーマの自動修復 + AutoCommit | `setup.RepairSchema` | しない。必要なら相手の Binder が直している |
| `user_data.enc` が無ければ作る | `binder.Load` の `SaveUserData` | 作らない。署名は記録しないので要らない |
| 整合性の修復（doctor） | `RunDoctor`（`doctor.go`） | しない。修復の報告（`TakeDoctorReport`）も無し |
| 移行 | `Convert`（`setup/convert`。フロントは `CompatVersionOnly` で黙って呼ぶ） | しない。`LoadReadOnly` が自分で `CheckCompat` を見て、スキーマの移行が要る（`CompatNeedConvert` など）なら開かない。古い形式の CSV はこの版のクエリで読めないため。`CompatVersionOnly`（スキーマは同じで binder.json の版だけ古い）は、書き換えずにそのまま開く |

アプリの設定（`setting.json`。開いた履歴・最後に見たノート・ウィンドウ位置など）は、バインダーの外なので今までどおり書いてよい。

### csvq の読み取りについて

csvq は読むときに、`db/` に一時的な読み取りロックのファイル（`.rlock`）を作り、読み終えると消す。
書く側はこのファイルを見て待つので、**別のプロセス同士で CSV を読み書きしても壊れない**ようになっている。
これはバインダーの中身を変えるものではないので、読み取り専用でもこのままでよい
（`fs` の `Status` は `db/` を見ないので、未記録一覧にも出ない）。

### 相手が書いている途中に読む

相手の Binder が記録・取り込み・ブランチ切替などをしている最中に読むと、
途中の状態（`.git/index` の書きかけ、CSV とファイルの食い違い）を読んで失敗することがある。
読む側は書かないので壊れはしない。失敗したらエラーを出し、利用者が読み直す。

## Go 側

### 開く入口

- `fs.LoadReadOnly(dir)` — `fs.Load` と同じだが、インデックスの自動復旧をせず、`FileSystem` に読み取り専用の印を立てる
- `db.New(dir, db.ReadOnly())` — `Instance` に読み取り専用の印を立てる（`DBOptions` に足す）
- `binder.LoadReadOnly(dir)` — 上の表のとおり、書き込むものを飛ばして開く。`Binder` に `readOnly bool` を持たせ、`ReadOnly()` で返す。
  `Close()` は `readOnly` なら `ReleaseOpen` を呼ばない
- `api.App.LoadBinderReadOnly(dir)` — `LoadBinder` と同じ流れ（前のバインダーを閉じる・履歴を保存する）で `binder.LoadReadOnly` を使う。
  `StartupOk`（起動時の自動オープンのクラッシュ検出）は、読み取り専用で開けたときも立ててよい
- `api.App.IsReadOnly()` — 開いているバインダーが読み取り専用か。フロントが開いた直後と、別ウィンドウ（履歴・プレビュー・検索）が起動したときに読む

### 書き込みを止める（2 段）

**1 段目: 一番下（fs と db）で止める。これが正**。上の層で止め忘れても、ここで必ず止まる。

- `fs.ErrReadOnly` / `db.ErrReadOnly`（sentinel）を足す
- `db`: 書き込みは全部 `Instance.run`（`db/db.go`）を通っているので、そこで `readOnly` なら `ErrReadOnly` を返す
- `fs`: ファイルを書く・消す下回り（`fs.go` の `Create` / `create` / `writeFile` / `mkdir` / `copyFile` / `copyReader` / `DeprecatedRemove`、
  それ以外のファイルで `os.Remove` / `os.Rename` / `billy` の `Remove` / `Rename` を直接呼んでいるところ）と、
  git の状態を変える操作（`git.go` のコミット・ステージング・ブランチ・リセット・復元・取り込み・送信・リモートの追加と編集・履歴の整理、`user.go` の `SaveUserData`）の先頭で止める。
  洗い出しは実装の最初にやる（`grep` で `os.Remove|os.Rename|WriteFile|\.Commit\(|Worktree\(\)` 等）。漏れは下の「テスト」で見つける
- 止める順番の注意: 1 つの操作が db → fs の順に書くとき、db で止まれば fs まで行かない。fs → db の順でも、最初の書き込みで止まる。
  どちらも止めるので、**途中まで書いて残る**ことは無い

**2 段目: API 層で、`Binder` を通らない書き込みを先に断る**。1 段目は `Binder` が持つ `FileSystem` / `Instance` の印を見るので、
ほかの入口で作った `FileSystem` には効かない。

- `runClosed`（取り込み・復元・ブランチ切替・履歴の整理。`api/git.go`）は、バインダーを閉じてから
  `binder.OpenRepository`（中は普通の `fs.Load`）で開き直し、そこへ書き込む。**読み取り専用で入ると書いてしまう**:
  `holdOpen` は相手のロックに当たって警告を出すだけで先へ進み（`api/binder.go`）、`OpenRepository` はロックを見ないため。
  そのあとの `LoadBinder` はロックに当たって失敗し、`reload_error`（バインダーが開いていない状態）にもなる。
  `runClosed` の先頭で `a.current.ReadOnly()` なら `ErrReadOnly` を返し、閉じる前に断る
- バインダーを開かずに書く `*ByPath`（`RestoreToCommitByPath` / `SwitchBranchByPath`）は、`binder.LockRepository` でロックを取りに行くので、相手が開いていれば今でも失敗する。そのままでよい
- バインダーを開かずに読む `*ByPath`:
  - `GetOverallHistoryByPath` / `GetCommitFilesByPath`（`repository.go` の `OverallHistoryByPath` / `CommitFileEntriesByPath`）は、
    まず普通の `binder.Load` で開く（ロックが取れれば doctor などで**書く**。ロックを持って書くので壊しはしない）。
    相手がロックを持っていれば失敗し、`OpenRepository` → `fs.Load` に回る
  - `ListBranchesByPath` / `CurrentBranchByPath` は `OpenRepository` → `fs.Load`
  - `fs.Load` のインデックスの自動復旧は、以前はロックを持たなくても動き、相手が書いている最中のインデックスを壊すことがあった。
    **2026-11-18 に直した**（印を持つときだけ復旧する。`fs/AGENTS.md` のトラブルシュート）。今は `fs.Load` を通るだけなら書かない
  
  読むだけの `*ByPath` は、`binder.LoadReadOnly` と `binder.OpenRepositoryReadOnly`（`fs.LoadReadOnly` を使う）に切り替える。
  名前の解決に DB が要るものは `LoadReadOnly`、git だけで済むものは `OpenRepositoryReadOnly`。
  読むだけの画面で doctor などが動かなくなる（ロックが取れたときの書き込みも無くなる）

### エラーの見せ方

- `userError`（`api/error.go`）で `fs.ErrReadOnly` / `db.ErrReadOnly` / `binder.ErrReadOnly`（使うなら）を `go.error.readOnly`
  （「読み取り専用で開いています」）に対応させる。種類は `Warning`
- 「別の Binder で開かれている」をフロントが見分けられるように、`MessageError` に `Code`（JSON は `code`）を足す。
  `openedElsewhereError` は `Code: "openedElsewhere"` を入れる。フロントの `parseError`（`src/error.js`）は `code` をそのまま返す。
  本文の文字列で見分けない（言語で変わるため）

## フロント側

### 開く流れ

1. 今までどおり `CheckCompat` → `LoadBinder`（`app/App.jsx` の `openBinder` / `loadBinder`）
2. `LoadBinder` が `code: "openedElsewhere"` で失敗したら、スナックバーにエラーを出し、右端に「読み取り専用で開く」ボタンを出す
   （`Message.jsx` の `action: { label, onClick }`。Doctor の修復通知の「履歴」と同じ仕組み）。
   起動時の自動オープンでも同じ。スプラッシュは今までどおり外し、バインダー一覧に戻る
3. ボタンで `LoadBinderReadOnly(dir)` を呼び、成功したら `loadBinder` の成功時と同じくエディタへ移る（前回見ていたノートへ）
4. 開いたあと `IsReadOnly()` を読んで、アプリ全体の状態（下の `ReadOnlyContext`）に入れる

### 読み取り専用の状態を配る

- `ReadOnlyContext`（`src/readOnly.js` などに `useReadOnly()`）を `App.jsx` で持ち、配下の部品はここを見て書き込みの操作を出さない
- 別ウィンドウ（`OverallHistoryApp` / `HistoryApp` / `PreviewApp` / `SearchApp`）は App の配下にないので、起動時に `IsReadOnly()` を自分で読む
- 左メニュー（`app/Menu.jsx`）の上に「読み取り専用」と状態を出す。そこに次の 2 つのボタンを置く:
  - 読み直す — `LoadBinderReadOnly` をもう一度呼んで、今見ているノートを開き直す（相手の変更を見る）
  - 編集できるように開き直す — 普通の `LoadBinder` を呼ぶ。相手がまだ開いていれば、今までどおり「別の Binder で開かれています」になり、読み取り専用のまま残る
- 操作の説明文は画面に書かない（状態の表示とボタンだけ）

### 出さない・押せなくするもの

Go 側で止まるので、ここで漏れても壊れはしない（エラーが出るだけ）。それでも、押せるのに失敗するボタンは出さない。

| 場所 | 読み取り専用では |
|---|---|
| 左メニュー（`app/Menu.jsx`） | Binder表示・検索・履歴・バインダー設定は出す。テンプレート設定・未記録一覧・未公開一覧（Publish）は出さない。いちばん上に「読み取り専用」の表示とボタン（下の「読み取り専用の状態を配る」） |
| バインダー設定（`dialogs/BinderModal` / `Binder.jsx` / `RemoteSetting` / `PluginSetting` / `RootFileSetting`） | 値は見られる。保存・追加・編集・削除のボタンは出さない。入力欄は読み取りだけにする |
| ツリー（`components/BinderTree.jsx`） | 選ぶ・開閉はできる。右クリックのメニュー（作成・削除・公開など）、ドラッグでの移動（`MoveNode`）、ファイルのドロップ（`ImportLocalFiles`）はしない |
| エディタ（`components/editor/Component.jsx`） | 本文は読めるが書けない（下の `EditorArea` の `readOnly`）。保存（`editor-save.js` のデバウンス・Ctrl+S）、挿入系のツールバー・メニュー（`EditorToolbar` / `ToolbarMenus`）、画像の貼り付け・ドロップ、公開・非公開（`useEditorPublish`）は出さない／動かさない。プレビュー・アウトライン・検索（置換は除く）・ダウンロード（バインダーの外に書くので可）・ブラウザで開くは使える |
| メタ編集ダイアログ（`dialogs/*MetaDialog.jsx`） | 開けるなら見るだけ。保存ボタンを出さない |
| 履歴（`BranchHistoryModal` / `OverallHistoryApp` / `OverallHistoryRight`） | 一覧・差分は見られる。復元・ブランチ操作・取り込み・不要データの削除は出さない |
| 自動保存（`App.jsx` の `setupAutoSave`） | タイマーを動かさない |

共有のエディタ（`_cmd/shared/frontend/editor/EditorArea.jsx`）には今 `readOnly` が無い。
`readOnly` を足して textarea の `readOnly` 属性に渡し、入力支援（`handleMarkdownKeyDown`）・貼り付け・オートコンプリートを動かさない。
Lite は使わないので既定は `false`。

## 言語ファイル

`setup/defaults/_assets/languages/{ja,en}.json` に足す（`_docs/skills/binder-i18n-theme/SKILL.md`）:

- `go.error.readOnly` — 読み取り専用で開いています / This binder is open read-only
- 「読み取り専用で開く」「読み取り専用」「読み直す」「編集できるように開き直す」（フロントのキー。場所は既存の `binder.*` などに合わせる）

新しい `go.error.*` は、言語ファイルが古い（`~/.binder` へ配り直す前）とキーが出てしまう。
`openedElsewhereError` と同じく、キーがそのまま返ったら別の文に戻すか、フロントのキーだけで済むならそちらにする。

## テスト

- **Go: 読み取り専用で書き込み API を全部呼んでも、バインダーが 1 バイトも変わらない**。これを要にする
  - バインダーを作り（`api` パッケージの `closed_test.go` の `TestMain` の下に置く。設定の保存先を一時ディレクトリへ向けている）、
    `.git` を含むディレクトリ全体のパスと中身のハッシュを取る
  - `LoadBinderReadOnly` で開き、`api.App` の書き込み系メソッドを表にして全部呼ぶ。どれもエラー（`go.error.readOnly` か、開いていないなどの別のエラー）になること
  - もう一度ハッシュを取り、同じであること（csvq の `.rlock` は残っていても除く）
  - 書き込み系メソッドの表は、`api` の公開メソッドを reflect で並べ、読むだけのものを除外リストに書く形にする。
    **新しい API を足したとき、どちらにも入っていなければテストが落ちる**ようにして、止め忘れを防ぐ
- Go: `binder.LoadReadOnly` は「開いている」印を取らない（ほかのハンドルからロックが取れる）。`Close` でも印のファイルを消さない
- Go: `runClosed` を通る操作が、閉じる前に断ること（`a.current` が残っていること）
- Go: 読むだけの `*ByPath` を、ほかのハンドルがロックを持っているバインダーに呼んでも、ディレクトリが変わらないこと（上と同じハッシュの比べ方。
  インデックスを壊しておいても書き直さないこと）
- Go: `openedElsewhereError` の `Code` が JSON に出ること（`api/message_test.go`）
- フロント: `parseError` が `code` を返す。`openedElsewhere` のときにスナックバーへボタンが出る。読み取り専用でメニュー・ツリー・エディタの書き込み操作が出ない（vitest。`src/__tests__/`）
- 実機: Binder を 2 つ起動し、1 つ目で開いているバインダーを 2 つ目で読み取り専用で開く。1 つ目で編集・記録 → 2 つ目で読み直して反映されること。
  1 つ目を閉じて 2 つ目で「編集できるように開き直す」が通ること。Windows（LockFileEx）と macOS / Linux（flock）の両方

## 進め方の案

1. Go の下回り: `fs.LoadReadOnly` / `db.ReadOnly` と、fs・db の書き込みを止める（洗い出し込み）。要のテストを先に書き、表の漏れで落ちるのを確かめてから止める場所を埋める
2. `binder.LoadReadOnly` / `OpenRepositoryReadOnly` と API（`LoadBinderReadOnly` / `IsReadOnly` / `runClosed` の先頭の断り / 読むだけの `*ByPath` の切り替え / `MessageError.Code`）。
   バインディングを再生成する（`api/` だけを変えたときは task が飛ばすので、AGENTS.md の直接の生成コマンドで）。
   `*ByPath` の切り替えは読み取り専用で開かなくても効く直しなので、先に別のコミットにしてよい
3. フロント: スナックバーのボタン → 開く → `ReadOnlyContext` → メニュー・ツリー・エディタ・ダイアログ・履歴・自動保存・別ウィンドウ
4. 実機で確かめ、`AGENTS.md`（主要な型・操作の導線）、`fs/AGENTS.md`（「開いている」印）、`api/AGENTS.md`、`_docs/skills/binder-user-error/SKILL.md` を更新する

## 決めたこと（2026-11-18）

1. **入口** — 「別の Binder で開かれています」のスナックバーのボタンだけ。バインダー一覧の各行のメニューには置かない（ロックが無いのに読み取り専用で開く入口は作らない）
2. **相手が閉じたあと** — 利用者が「編集できるように開き直す」を押したときだけ開き直す。ロックを見張って知らせることはしない
3. **バインダー設定** — 見るだけで開ける。左メニューに出し、各タブの値は見られるが、保存・追加・削除のボタンは出さない
   （個人情報設定・リモート・プラグイン・ルートファイルのタブも同じ。認証情報の中身は今までどおり出さない）
4. **読み取り専用の表示の位置** — 左メニューの上。「読み取り専用」の表示と、読み直す・編集できるように開き直すのボタンをここに置く
