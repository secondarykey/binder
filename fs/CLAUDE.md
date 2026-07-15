# fs パッケージ（Gitバックのファイルシステム）

go-gitリポジトリのラッパー。バインダー内の全コンテンツ変更はここを経由し、gitコミットされる。
`billy.Filesystem` 抽象により OSファイルシステム（osfs）とインメモリ（memfs）の両方をサポートする（テストは `NewMemory()` を使用）。

## FileSystem の生成

- `New(dir)` / `NewWithBranch(dir, branch)` — git init して新規作成
- `NewMemory()` — インメモリ（テスト用）
- `Load(dir)` — 既存バインダーを開く
- `Clone(dir, url, branch, info)` — リモートからクローン。SingleBranch クローン後に fetch refspec をワイルドカードへ戻す処理を含む

## バインダー内のファイルレイアウト（path.go）

パス生成は必ず `path.go` の関数を使う（ハードコードしない）。パスは常に `/` 区切りへ正規化される（`ConvertPaths` / `convertPaths`）。

**private（編集ソース、IDがファイル名）**:
```
notes/{note_id}.md
diagrams/{diagram_id}.md
assets/{asset_id}              ← 0.2.2以降フラット構造
assets/meta/{note_id}          ← 0.4.8以降のメタファイル
layers/{layer_id}.json
templates/{template_id}.tmpl
plugins/{engine}/*.js
db/*.csv                       ← csvqテーブル（db.goがパス解決）
binder.json                    ← BinderMeta（meta.go）
user_data.enc                  ← 暗号化git認証情報（.gitignore対象）
```

**public（公開HTML、aliasがファイル名）**: `docs/`（`publishDir`、`SetPublishDirectory()` で変更可）
```
docs/index.html                ← id "index" のノート
docs/pages/{note_alias}.html
docs/images/{diagram_alias}.svg
docs/images/meta/{note_alias}
docs/assets/{asset_alias}
docs/layers/{layer_alias}.svg
```

## コミットと署名（git.go）

- `Commit(m, files...)` — **ユーザ署名**でコミット。バインダー固有署名（`SetUserSig`）> アプリ設定（`settings.Get().Git`）の優先順
- `AutoCommit(m, files...)` / `CommitAll(m)` — **システム署名**（"Binder System" <binder@localhost>）。自動処理・マイグレーション用
- `M(header, name)` — "DB {header} : {name}" 形式のコミットメッセージ生成
- ステージング: `AddFile` / `RemoveFile` / `AddDBFiles`（全CSVテーブル）/ `SchemaCommit`（スキーマ変更＋全テーブルコミット）

## Status とキャッシュ（git.go）

- `Status()` → `ModifiedFiles`（`[]*Modified{Id, Typ, Status}`）。型別フィルタ: `.Notes()` / `.Diagrams()` / `.Assets()` / `.Layers()` / `.Templates()` / `.Files()`
- `getModelType(path)` がパス先頭ディレクトリから種別（note/diagram/asset/layer/template）を判定。ルート直下のユーザーファイルは `"file"`。`db/`・`binder.json`・予約ファイル・`assets/meta/` は管理外として無視
- **blobハッシュ検証**: go-gitはWindowsでmtime不一致等により未変更ファイルを変更ありと誤検知するため、HEADのblobハッシュと実内容を比較して実変更のみ返す
- **短TTLキャッシュ（2秒）**: フルstatus＋ハッシュ比較は重いためキャッシュする。ワークツリー・インデックスを変更する操作の後は必ず `invalidateStatus()` を呼ぶこと（アプリ外のgit操作との不整合はTTLで自然解消）

## ファイル別の責務

- **fs.go** — `FileSystem` 本体、生成、低レベルI/O（create時に自動 git add）
- **git.go** — git操作全般: リモートCRUD・`Fetch`・`MergeFFOnly`・`Push`・`PushDocs`（docs/のみの公開push）・ブランチ操作・`ResetHard(To)`・履歴（`GetOverallHistory` / `GetFileHistory` / `GetNowPatch` / `GetHistoryPatch`）・復元（`RestoreToCommit` / `RestoreFile`）
- **note.go / diagram.go / asset.go / layer.go / template.go** — エンティティ別ファイル操作（Create/Read/Write/Delete/Publish/Unpublish/Rename）。テンプレートは `AddTemplateFrame` / `StripTemplateFrame` で編集用フレームを付脱
- **rootfile.go / plugin.go** — ルートファイル・プラグイン（詳細は Skill: `binder-plugin-rootfile`）
- **meta.go** — `BinderMeta`（binder.json）: version / minAppVersion / name / detail / markedUrl / mermaidUrl / optimizeImage / publishOnly / publishBranch / publishSubDir / previewColorScheme。`Schema` フィールドは0.3.2未満との後方互換用（非推奨）
- **db.go** — `db/` 配下CSVテーブルのパス解決・ステージング
- **user.go / crypt.go** — `user_data.enc`（暗号化された `UserInfo`: git署名＋認証情報。`AuthType`: basic / token / ssh_key / ssh_agent）
- **merge.go / merge_csv.go / diff3.go** — 3-wayマージ。CSVは行単位マージ（`MergeAnalysis` / `MergeLog`）。マージ後の整合性回復: dangling parent の index直下への救済（`RepairDanglingParents`）、structure行が失われた実体ファイルの復元
- **diff.go** — 差分・パッチ生成ヘルパー
- **cleanup.go** — 履歴圧縮: `GetCleanupInfo`（統計）→ squash 実行で `.git/objects` を削減
- **search.go** — 未実装スタブ

## トラブルシュート: gitインデックス破損（index file corrupt）

- **症状**: バインダーの全操作が「An unexpected error occurred」になる。git CLI では
  `error: index uses <文字化け> extension, which we do not understand` /
  `fatal: index file corrupt` と表示される
- **原因**: go-git はインデックス（`.git/index`）を lock ファイルや一時ファイル経由の
  リネームを使わず truncate + 直接書き込みで更新するため、書き込みの交錯・中断で壊れる。
  アプリ内の並行書き込みは `lockedStorage`（storage.go）と `gitMu`（fs.go）で防いでいるが、
  **書き込み中の電源断・プロセス強制終了・外部ツールの干渉では今後も起こりうる**
- **復旧手順**: インデックスは HEAD から再構築できる派生物であり、削除してもコンテンツは失われない
  1. Binder を終了し、バインダーのディレクトリで `.git/index` を削除する（念のためコピーを取っておく）
  2. `git reset` を実行する（HEAD からインデックスを再構築。ワークツリーのファイルはそのまま）
  3. 破損時に書き込まれかけたファイルが未記録として残るため、アプリを開き未記録一覧から記録する
  4. 二重操作が原因だった場合は作りかけのゴミデータ（ノート等）が残ることがあるので、確認して削除する
- 破損検出に使える go-git の sentinel: `plumbing/format/index` の `ErrMalformedSignature` /
  `ErrInvalidChecksum` / `ErrUnknownExtension` / `ErrMalformedIndexFile`（アプリ内自動復旧を実装する場合の入口）

## エラー sentinel

- `UpdatedFilesError`（更新ファイルなし）— API層で Info 扱い（Skill: `binder-user-error` 参照）
- `NoUpdated`

## テスト

`go test ./fs/...`。テストは `NewMemory()`（インメモリgit）ベースで実ディスク不要。パッケージ内部へのアクセスは `export_test.go` 経由。
