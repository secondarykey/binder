---
name: binder-user-error
description: >
  Binderのユーザ向けエラー表示の仕組み（Go → Wails → フロント）と、
  新しいエラーをユーザライクにする手順を提供する。
  MessageError、userError、MarshalError、sentinel エラー、parseError、
  スナックバーのエラー表示、go.error.* 翻訳キー、エラーの Kind（info/warning/error）を扱う。
  APIメソッドのエラーハンドリング追加・変更、エラーメッセージの翻訳・改善、
  「エラーをユーザ向けにする」「エラー表示を追加する」といった作業では必ずこのSkillを参照すること。
---

# ユーザ向けエラー（Go → Wails → フロント）

API メソッドが返すエラーを、フロントで「1行メッセージ＋詳細＋折りたたみデバッグ情報」として表示する仕組み。

## 伝達メカニズム（Wails v3）

バインドメソッドが error を返すと Wails は
`CallError{ Message: err.Error(), Cause: MarshalError(err), Kind: "RuntimeError" }` を JSON 化して HTTP エラーボディで返す。フロントの `@wailsio/runtime` は `throw new Error(<その JSON>)` するため、**JS の `Error.message` がこの envelope JSON 文字列**になる。`application.Options.MarshalError func(error) []byte` フックで envelope の `cause` に任意の構造化 JSON を載せられる（非nil を返すとそれが `cause` に入り、nil ならデフォルトの `json.Marshal(&err)`≒`{}` にフォールバック）。

## Go 側 (`api/message.go`)

- **`MessageError{ Body, Detail, Kind, Cause }`** — ユーザ向け構造化エラー。`Error()` は人間可読1行（ログ用）、`Unwrap()` で `errors.Is/As` チェーン維持、`MarshalJSON()` は `{body, detail, kind, cause}` を返す（`cause` は `fmt.Sprintf("%+v", Cause)` で **xerrors のスタックトレース**＝関数名・file:line を含める）
- **`Kind`** — メッセージ種別。`"error"`（既定・省略可）/ `"warning"` / `"info"`。フロントのスナックバー色・severity を制御する。`Wrap` 系は Kind 空（= error 扱い）、`Info()` / `Warning()` が専用コンストラクタ
- コンストラクタ: `Wrap(cause, body)`, `Wrapf(...)`, `WithDetail(cause, body, detail)`, `Info(cause, body)`, `Warning(cause, body)`
- **`MarshalError(err)`** — `_cmd/binder/main.go` の `application.Options.MarshalError` に登録。`errors.As` で `*MessageError` を探して JSON 化、無ければ nil
- **`userError(err)`** (`api/error.go`) — 内部エラーをユーザ向け `MessageError` に変換する API 境界のヘルパー。既知の sentinel（`binder.ErrNoteHasChildren`, `db.DuplicateAlias` 等）を `settings.T("go.error.*")` の翻訳メッセージへマッピングし、未知は `go.error.unexpected`（「異常が発生しました」）で包む。元 err は常に `Cause` に保持
- API メソッドは `fmt.Errorf("X() error\n%+v", err)` の代わりに `return userError(err)` を返す。原因が明確な箇所は `userError` の switch にケースを追加して段階的に改善する
- **MessageError は API 境界（`userError`）でのみ生成する**。fs/db/binder などの下位層は通常の `xerrors` を返し、変換は api 層が担う（だから型も `api` パッケージに置く）

## 方針: 新しいエラーをユーザライクにする手順

2段階。sentinel は「専用メッセージを出したい原因」だけ作ればよい。

1. **土台**: 対象 API メソッドの `fmt.Errorf("X() error\n%+v", err)` を `return userError(err)` に置換する。これだけで最低「異常が発生しました」＋折りたたみデバッグになる。`log.PrintStackTrace(err)` は残す
2. **個別メッセージ（任意）**: 専用メッセージを出したい原因だけ、
   - 下位層（`binder`/`db`/`fs`）に sentinel を定義（`var ErrXxx = errors.New(...)`）、`xerrors.Errorf("%w: ...", ErrXxx)` で包んで返す。API 層特有の条件は `api/error.go` に置く（例 `ErrUncommittedChanges`）
   - `userError` の switch に `case errors.Is(err, ErrXxx): return Wrap(err, settings.T("go.error.xxx"))` を追加。エラーではなく情報通知（例: 変更なし）は `Info(err, ...)` を、警告は `Warning(err, ...)` を使う
   - `setup/_assets/languages/{en,ja}.json` の `go.error.*` にメッセージを追加
3. 据え置いてよいもの: `fmt.Errorf("%s", settings.T("go.error.*"))`（既に翻訳済み）、panic 復帰、HTML生成の parse error 等の固有メッセージ。内部ヘルパーの `xerrors(%w)` は伝播用に維持（上位 API が `userError` で包む）
   - 既存 sentinel 例: `binder.ErrNoteHasChildren` / `binder.ErrAssetHasLayers` / `db.DuplicateAlias` / `db.DuplicateKey` / `convert.ErrNotBinder` / `api.ErrUncommittedChanges` / `fs.UpdatedFilesError`（Info）

## フロント側

- **`src/error.js` の `parseError(err)`** — `err.message` を `JSON.parse` して envelope を取り出し、`cause` に `body` があれば `{ body, detail, debug, kind }` に正規化（`cause.cause`＝Goスタックは `debug` へ）。`cause` が無い未変換エラーは `message` の先頭行を `body`、残りを `debug` にフォールバック。JSON でない文字列（フロント由来・`t()`）はそのまま `body`。`": panic:"` を含むメッセージは Wails v3 の panic recovery として検出し、body を `go.error.unexpected` に差し替える
- `src/Message.jsx`（スナックバー）/ `src/dialogs/components/DialogError.jsx` が `parseError` を使い、**body をスナックバー**、ダブルクリックで **detail**、折りたたみ「デバッグ情報」で **debug**（Goスタック＋JSスタック）を表示。Go 側が `kind` を指定していればスナックバーの severity（色）に反映する（info=青、warning=橙、error=赤）
- i18n: ユーザ向けメッセージは `go.error.*`（Go側）、折りたたみ見出し等は `common.*`

## 注意

- `MessageError` 型・`MarshalError` 等はバインド対象メソッドではないため、追加・変更してもフロントエンドバインディング再生成は不要
- Binder Lite は `binder/api`（fs/db を巻き込む）を import できないため `MarshalError` を登録していない。Lite は `MessageError` を生成しないので実害なし。共有が必要になったら lite が import できるパッケージへ切り出す
