# バインダーレベルマイグレーション履歴

## このファイルの目的

`setup/convert/` は、バインダー（gitリポジトリ）を開く際にアプリバージョンとバインダーのスキーマバージョンにギャップがある場合、CSVスキーマとファイルシステム構造を段階的に移行する仕組みを持つ。

0.13.x で、0.4.8 以前の9件の移行コード（0.1.0/0.2.0/0.2.1/0.2.2/0.3.3/0.3.4/0.4.5/0.4.7/0.4.8）が削除された。`MinSupportedBinderVersion`（`setup/convert/convert.go`）が 0.4.8 に引き上げられ、これより古いバインダーは一度旧アプリで開いて移行を済ませてから使う運用になる。

このファイルは、削除されたコードが実装していた「スキーマ進化のやり方」のノウハウを失わないための記録である。**実装そのものが必要な場合は git 履歴（0.13.0 以前のタグ・コミット）を参照すること。** 以下は削除前の実装を読んで抽出したパターン集であり、コードの完全な複製ではない。

新しい移行を追加する具体的な手順は `setup/convert/CLAUDE.md` を参照。

---

## 移行フレームワークの仕組み

### 全体構成

```
setup/convert/convert.go       — オーケストレータ。migrations リスト、Run()
setup/convert/db/convert.go    — Apply()：Converter配列を順に適用しFileSetを確定
setup/convert/db/core/core.go  — Converter型・FileSet型
setup/convert/db/{ver}/converter.go — バージョンごとのCSV変換ロジック
setup/convert/fs/migrate.go, convert{ver}.go — バージョンごとのFS移行ロジック（削除済み）
setup/convert/meta.go          — binder.json 読み込み・旧形式フォールバック
setup/convert/config.go        — 0.4.5専用: config.csv 読み込みヘルパー（削除済み）
```

### migrations リストとバージョン判定

`convert.go` の `init()` で各バージョンを `*Version`（`internal.Version`）として用意し、`migrations []migration` にバージョン順で登録する。`migration` は次の形。

```go
type migration struct {
    ver *Version
    run func(dir, dbDir string, state *migrateState) error
}
```

`Run(dir, ver)` はバインダーの現在バージョン `ov` を `binder.json` から読み取り、リストを順に走査して `ov.Lt(m.ver)` が真の移行だけを実行する。文字列比較ではなく `internal.Version` の `Lt()` を必ず使う（コーディング規約にも明記）。この「未満なら適用」というシンプルな判定のおかげで、リストの並び順どおりに古いバインダーへ複数バージョン分の移行を連続適用できる。

### CSV変換: FileSet と Apply

CSV側は `dbconvert.Apply(dbDir, []Converter{...})`（`db/convert.go`）が実行する。

1. `dbDir` 内の全 `*.csv` を列挙し、それぞれを `core.NewFileSet(ファイル名)` でラップする（`Org == Dst` の初期状態）。
2. 登録された `Converter` を順番に適用する。各 Converter は `func(dir string, tables []*FileSet) ([]*FileSet, error)` で、対象テーブルを見つけたら中間ファイル（例 `notes020.csv`）に変換結果を書き出し、その `FileSet` の `Dst` を中間ファイル名に更新して返す。対象外のテーブルはそのまま素通しする。
3. 最後に `execFileSet(dbDir, files)` が後始末をする。
   - `FileSet.Dst` の集合に含まれないファイル（例: 旧 `schema.version`）は削除する。
   - `Dst != Org` のものは `os.Rename(Dst, Org)` で本来の名前に戻す（`notes020.csv` → `notes.csv`）。既にリネーム済み（2回目実行）なら `os.Stat` で検知してスキップする。

複数の Converter を1回の `Apply` に積んだ場合、後続 Converter は前段が返した `FileSet`（中間ファイル名を指す `Dst`）をそのまま受け取って処理を続ける。`convert.go` 側では基本的に1バージョン1 Converter を `applyDB()` ヘルパー（`dbconvert.Apply(dbDir, []Converter{c})` のラッパー）で適用している。

### migrateState によるコミット分岐制御

`migrateState` はループ全体を通して共有される構造体で、移行本体（CSV/FS変換）とは別に「その移行に付随する git コミットや後処理が必要か」を記録するフラグを持つ。例：

```go
type migrateState struct {
    configMigrated       bool // 0.4.5: config.csv → binder.json
    configName, configDetail string
    docsMigrated         bool // 0.4.7: docs/ クリア
    gitignorCreated      bool // 0.7.2: .gitignore 作成
    diagramStyleMigrated bool // 0.9.7: diagram_style.tmpl 作成
}
```

各 `migration.run` が該当フラグを立て、`Run()` 本体がループ後にフラグを見て専用のコミットを打つ（後述）。「全移行共通の最終コミット」と「特定移行だけに必要な専用コミット・ファイル」を分離するための橋渡し役。

### スナップショット・ロールバック・直列化

- `migrationMu sync.Mutex`（パッケージ変数）で `Run()` 全体を直列化する。go-git の `.git/index` 操作はスレッドセーフでないため、同一バインダーへの並行 `Run()` 呼び出し（React StrictMode の二重マウント等）を防ぐ。
- 移行開始前に `bfs.Status()` で未記録の変更があるか確認し、あれば `"Pre-migration safety snapshot (%s)"` として `CommitAll()` する。これはロールバック先の固定点になる。`git reset --hard` は追跡ファイルの未コミット変更を無差別に破棄するため、スナップショットを取らないとユーザーの未記録作業が失われる。
- `defer` で、`err != nil`（＝移行失敗）のときだけ `bfs.ResetHardTo(rollbackTarget)` を呼ぶ。`rollbackTarget` は「スナップショットを取った場合はスナップショットのHEAD、取らなかった場合は元のHEAD」。
- 移行本体は `for _, m := range migrations { if ov.Lt(m.ver) { m.run(...) } }` という素直なループ。1件でも失敗したら即座に `err` を返し、defer がロールバックする。

### 最終処理（全移行共通）

ループ後、`Run()` は次を必ず行う。

1. `binder.json` の `Version`/`MinAppVersion` を更新し保存（`Schema` フィールドは空文字にして非推奨扱い）。
2. `removeOldSchemaFiles()` で旧 `db/schema.version` 等を削除。
3. `db.EnsureTableFiles()` で欠損テーブルCSVを補完（旧ブランチ切替等でテーブルが揃っていないケースに対応）。
4. 必須ディレクトリ（notes/diagrams/templates/assets/layers）を `MkdirAll` で保証。
5. `migrateState` のフラグに応じた専用コミット（0.4.5, 0.4.7, 0.9.7 のファイルステージ）。
6. 汎用コミット（`AddDBFiles()` + `binder.json` + `.gitignore` をステージし `"Update binder version (%s -> %s)"` でコミット）。個別コミットを持たない移行（0.1.0, 0.2.0 等）でもここで確実にコミットされる。

`AutoCommit`/`CommitAll` の戻り値が `fs.UpdatedFilesError` の場合は「変更なし」を意味するため無視する（新規インストール直後や既にコミット済みのケース）。

---

## 全移行の履歴表（0.1.0〜0.10.2、13件）

| バージョン | DB変換 | FS移行 | 備考 |
|-----------|--------|--------|------|
| 0.1.0 | assets に binary カラム追加 | なし | コード削除済み（git履歴参照） |
| 0.2.0 | structures テーブル新設、notes/diagrams/assets から parent_id/name/detail を分離・移動 | なし | コード削除済み（git履歴参照） |
| 0.2.1 | alias を各テーブル（notes/diagrams/assets）から structures に集約 | なし | コード削除済み（git履歴参照） |
| 0.2.2 | なし（空変換） | assets ディレクトリのフラット化（`{parentId}/{assetId}` → `{assetId}`） | コード削除済み（git履歴参照） |
| 0.3.3 | templates からsnippet用タイプ（note/diagram/template）の行を削除、html_layout→layout, html_content→content にリネーム | なし | コード削除済み（git履歴参照） |
| 0.3.4 | templates に seq カラム追加（デフォルト0） | なし | コード削除済み（git履歴参照） |
| 0.4.5 | config.csv を削除 | なし | name/detail を binder.json に移行。専用コミットあり。コード削除済み（git履歴参照） |
| 0.4.7 | publish_date/republish_date を structures に移動、notes/diagrams から publish_date を削除 | docs/ ディレクトリを全クリア | 専用コミットあり。コード削除済み（git履歴参照） |
| 0.4.8 | なし（空変換） | assets/{noteId}-meta → assets/meta/{noteId} にリネーム | コード削除済み（git履歴参照） |
| 0.7.2 | なし | .gitignore 作成（user_data.enc 除外） | `MigrateResult.UserDataRequired` として呼び出し元に通知。現存 |
| 0.9.2 | assets に mime カラム追加（拡張子からMIME判定） | なし | 現存 |
| 0.9.7 | structures に private 列追加、diagrams に style_template 列追加、templates に diagram_style レコード追加 | templates/diagram_style.tmpl 作成 | 専用コミット（ファイルステージ）あり。現存 |
| 0.10.2 | なし（空変換、layers.csv は EnsureTableFiles で作成） | なし | 現存 |

---

## 実装パターン集

削除されたコードから抽出した「型」。新しい移行を書くときの参考にする。

### 1. カラム追加パターン

CSVを1行目（ヘッダ）と2行目以降（データ）に分けて `bufio.Scanner` で逐次処理し、決めた位置にカラムを挿入する。**冪等性**（後述）と**中間ファイル経由のリネーム**が共通の型。

**0.1.0（末尾付近への固定値挿入）**: assets.csv に `binary` 列を、`detail` の直後（index 5）に挿入。カンマ分割した `csv` 配列の要素をインデックスでシフトしながら組み立てる素朴な実装。

```go
newLine := make([]string, len(csv)+1)
for idx, clm := range csv {
    if idx >= 5 {
        if idx == 5 { newLine[idx] = "true" } // binary
        newLine[idx+1] = clm
    } else {
        newLine[idx] = clm
    }
}
```

**0.3.4（カラム名を検索して挿入位置を決める）**: templates.csv に `seq` を `detail` の直後に挿入。ヘッダ行を走査して `detail` の index を探し、見つからなければ末尾に追加するフォールバックを持つ。これが以後のバージョンの標準パターンになった。

```go
insertIdx := -1
for i, c := range cols {
    if c == "detail" { insertIdx = i + 1; break }
}
var newCols []string
if insertIdx < 0 {
    newCols = append(cols, "seq")
} else {
    newCols = append(append(append([]string{}, cols[:insertIdx]...), "seq"), cols[insertIdx:]...)
}
```

データ行にも同じ挿入ロジックを適用し、デフォルト値（`"0"`）を入れる。0.9.7 の `private`（false）、`style_template`（"diagram_style"）もこの型。

**0.9.2（詳しめ: 拡張子→MIME判定を伴うカラム追加）**: assets.csv に `mime` 列を追加する。単純なデフォルト値ではなく、他テーブル（structures.csv）を参照してファイル名を引き、拡張子から MIME タイプを判定する点が特徴。

- 事前に `buildAssetNameMap(p, tables)` で structures.csv を `encoding/csv`（`FieldsPerRecord = -1`, `LazyQuotes = true`）で読み、`type == "asset"` の行から `id -> name` マップを構築する。他の変換が `bufio.Scanner` + カンマ分割の素朴な方式なのに対し、この処理だけ `encoding/csv` を使っている（マルチバイト名やクォート付きフィールドを正しく扱うため）。
- `detectMimeByName(name, binary)` は `mime.TypeByExtension(ext)` をまず試し、空なら組み込みの `knownMimeTypes` マップ（拡張子→MIME の固定辞書）にフォールバックし、それでも不明なら `binary` フラグで `application/octet-stream` / `text/plain` を返す。OS の MIME データベースに依存しないためのフォールバック設計。
- カラム挿入自体は `binary` 列の直後に `mime` を挿む、標準パターン通り。

```go
func detectMimeByName(name string, binary bool) string {
    ext := strings.ToLower(filepath.Ext(name))
    if ext != "" {
        if m := mime.TypeByExtension(ext); m != "" { return m }
        if m, ok := knownMimeTypes[ext]; ok { return m }
    }
    if binary { return "application/octet-stream" }
    return "text/plain"
}
```

### 2. テーブル新設＋データ分離パターン（0.2.0）

structures.csv を新規作成し、notes/diagrams/assets の3テーブルそれぞれから `parent_id`/`name`/`detail` カラムを抜き取って structures 側へ移す、という「1対多のデータ移動」。

- `extractAndRemove(p, fs, tableName, typ, removeIdxs)` が汎用ヘルパーで、`removeIdxs`（例 `[]int{1,3,4}`）で指定したカラムを CSV から除去した新ファイルを書きつつ、除去した値を `[]extractEntry{id, parentId, name, detail, typ}` として収集して返す。notes/diagrams/assets 3テーブルに対して同じヘルパーを typ を変えて3回呼ぶ。
- 集めた `entries` から `structures020.csv` を新規生成する。`seqMap[parentId]` で親ごとの連番（`seq`）を採番しながら1行ずつ書き出す。
- 冪等性: ループ開始前に `structures.csv`（または中間名）が既に FileSet 内に存在すれば `hasStructures = true` とし、以降の抽出処理を丸ごとスキップする（＝2回目実行時の再抽出・再生成を防ぐ）。加えて `extractAndRemove` 内でもヘッダに `parent_id` が無ければ「既に変換済み」として素通しする二重チェック。

```go
now := time.Now().Format(time.RFC3339Nano)
for _, e := range entries {
    seq := seqMap[e.parentId] + 1
    seqMap[e.parentId] = seq
    line := fmt.Sprintf("%s,%s,%d,%s,%s,%s,%s,system,%s,system\n",
        e.id, e.parentId, seq, e.typ, e.name, e.detail, now, now)
    fp.Write([]byte(line))
}
```

新設テーブルは既存 `FileSet` リストに `append` する（`core.NewFileSet("structures.csv")` を作り `Dst` を中間ファイル名にセットしてから追加）。`execFileSet` はこの新エントリも他と同様にリネーム処理する。

### 3. データ集約パターン（0.2.1: alias を structures へ）

0.2.0 の逆方向に似た形。複数テーブルから同じ種類のデータ（alias）を1テーブルへ集約する。

- まず全テーブル（notes/diagrams/assets、または既に0.2.0で変換済みなら `*020.csv`）を走査して `id -> alias` の `map[string]string` を構築（`extractAlias`）。
- 次に structures 側に `alias` カラムを挿入し、`aliasMap[id]` の値を埋める。見つからなければ `id` 自身をフォールバック値にする（`alias, ok := aliasMap[id]; if !ok { alias = id }`）。
- 最後に各エンティティテーブルから `alias` カラムを除去する。
- 冪等性チェックが二重: ループ全体の前に structures 側が既に `alias` 列を持つか確認する `hasAlias` フラグと、各ヘルパー内部でのヘッダ確認の両方を持つ。「前段の中間ファイル名（`notes020.csv`）と本来名（`notes.csv`）の両方に対応できるよう `strings.HasSuffix(f.Dst, "notes020.csv")` のような判定をしている」点が、複数バージョンの移行が連鎖する際の典型的な注意点。

### 4. テーブル削除＋binder.json へのデータ移行パターン（0.4.5: config.csv → binder.json）

CSV変換の枠組みだけでは対応できない「CSVを消して別ファイル（binder.json）に値を移す」ケース。ポイントは **Apply でファイルが消える前に値を読んでおく** 順序。

`convert.go` の migration 定義:

```go
{v045, func(_, dbDir string, state *migrateState) error {
    state.configMigrated = true
    state.configName, state.configDetail = readConfigCSV(dbDir) // Apply前に読む
    return applyDB(dbDir, convert045.Convert045)                // Apply でconfig.csvをFileSetから除外→削除される
}},
```

- `readConfigCSV(dbDir)`（`config.go`）は csvq のエスケープ（`&#10;` 改行、`&#44;` カンマ等）を手動で `unescapeCSVField` してから `name`/`detail` を取り出す素朴な実装。ファイルが無い・パースできない場合は `"Binder"` にフォールバックする。
- `Convert045` 自体は「`config.csv` の `FileSet` をスキップして `rtn` に含めない」だけ。`execFileSet` は FileSet に含まれないファイルを削除するので、これだけで CSV が消える。
- `Run()` 本体側で `state.configMigrated` を見て、`meta.Name`/`meta.Detail` が空なら読み取った値を binder.json に書く。さらに専用のgitコミット（`RemoveFile(config.csv)` をステージ＋`AddFile(binder.json)`＋`"Migrate Config to binder.json"` でコミット）を打つ。全移行共通の汎用コミットとは別立てにすることで、コミット履歴上も「config.csv 廃止」という意味のまとまりが分かるようにしている。

このパターンの要点: **CSVの内容を読む処理は必ず Apply の前に置く**（Apply後だとファイルが既に消えている）。テーブル削除は Converter 側で「返す FileSet リストから除外するだけ」で足りる。

### 5. カラム移動パターン（0.4.7: publish_date/republish_date を notes/diagrams → structures）

「追加」と「削除」を1バージョン内の複数テーブルにまたがって対称に行う。structures.csv に `publish_date, republish_date`（ゼロ時刻 `"0001-01-01T00:00:00Z"` で初期化）を追加する一方、notes.csv と diagrams.csv からは `publish_date` 列を除去する。カラム除去のヘルパー (`removePublishDate`) は 0.2.1 の `removeAliasColumn` と同型（ヘッダからインデックスを探し、そのインデックスをスキップしてコピー）。

```go
newRow = append(row[:updatedUserIdx+1], append([]string{timeZero, timeZero}, row[updatedUserIdx+1:]...)...)
```

FS側もセットで動く（docs/ クリア。後述）。DB変換とFS変換が「同じ意味変更（公開日時の管理場所が変わる）」に紐づく場合、1つの `migration.run` の中で両方呼び出し、`state.docsMigrated` で専用コミットの対象に含める。

### 6. FS移行パターン

FS側の移行は `os` パッケージを直接使う。3例とも「壊れた状態にしない」ための工夫がある。

**0.2.2（assets ディレクトリのフラット化）**: `assets/{parentId}/{assetId}` → `assets/{assetId}`、メタファイルは `assets/{parentId}/meta` → `assets/{parentId}-meta` にリネーム。`docs/assets/` にも同じ処理を適用（private/public 両方）。ディレクトリを列挙し、サブディレクトリの中身を親へ `os.Rename` で移してから空になったサブディレクトリを `os.Remove`（削除失敗は warning ログのみで致命的扱いしない＝ベストエフォート）。

```go
for _, entry := range entries {
    if !entry.IsDir() { continue } // 通常ファイルは既にフラット、スキップ = 冪等性
    ...
    if err := os.Rename(src, dst); err != nil { return xerrors.Errorf(...) }
}
os.Remove(parentDir) // 失敗しても warning のみ
```

**0.4.7（docs/ クリア＋StagePublishDirRemovals）**: publish_date の管理場所が変わったことで公開済みコンテンツのメタデータ整合性が崩れるため、`docs/` 配下を丸ごと `os.RemoveAll` して「再公開が必要な状態」にする。ディレクトリが存在しなければ何もしない（`os.IsNotExist` チェック）。FS削除後、`Run()` 側で `bfs.StagePublishDirRemovals()` を呼び、gitの追跡対象だった `docs/` 配下のファイル削除を明示的にステージしてからコミットする（削除は `os.RemoveAll` で先に実施し、gitステージは別ステップという分離）。

**0.4.8（assets/{id}-meta → assets/meta/{id} のリネーム）**: 対象ファイルを `strings.HasSuffix(name, "-meta")` で抽出し、`assets/meta/` ディレクトリを `MkdirAll` してから1件ずつ `os.Rename`。対象が0件なら `MkdirAll` すら呼ばない（無駄なディレクトリを作らない）。

```go
if len(metaFiles) == 0 { return nil }
os.MkdirAll(metaDir, 0755)
for _, entry := range metaFiles {
    noteId := strings.TrimSuffix(entry.Name(), "-meta")
    os.Rename(filepath.Join(assetsDir, entry.Name()), filepath.Join(metaDir, noteId))
}
```

### 7. 冪等性の担保（全パターン共通の設計原則）

`Run()` は失敗時にロールバックするが、**ロールバック先はスナップショット（移行前）であり、成功した移行を個別に巻き戻す仕組みは無い**。そのため、途中まで進んだ移行が再実行されても壊れないよう、各層で以下を徹底している。

- **CSV変換**: ヘッダを読んで対象カラムが既に存在する／既に存在しないことを確認してから処理する。存在すれば（追加なら）またはしなければ（削除なら）その場で元の `FileSet` をそのまま返し、中間ファイルは作らず `Remove` して片付ける（例: 0.9.7 の `addPrivateToStructures` は `np.Close(); os.Remove(nf); return fs, nil`）。
- **execFileSet のリネーム**: `os.Stat(中間ファイル)` が失敗し、かつ `os.Stat(本来のファイル)` が成功する場合は「前回既にリネーム済み」と判断してスキップする（2回連続実行への耐性）。
- **FS移行**: `os.Stat` で対象の存在を確認してから作成する（0.7.2 の `.gitignore` 作成、0.9.7 の `diagram_style.tmpl` 作成）。ディレクトリ列挙ベースの移行（0.2.2, 0.4.8）は「対象が見つからなければ何もしない」が自然に冪等性を与える。
- この設計により、移行処理中にアプリがクラッシュした、あるいは `Run()` が2回連続で呼ばれた（実際に `migrationMu` のコメントにある通り、React StrictMode 等で発生しうる）としても、2回目の `Run()` は実質 no-op に収束する。

---

## 新しい移行の追加方法

具体的な手順（`migrations` リストへの追加方法、`migrateState` の使い方等）は `setup/convert/CLAUDE.md` の「移行の追加方法」節を参照。上記のパターン集はその際の実装リファレンスとして使う。
