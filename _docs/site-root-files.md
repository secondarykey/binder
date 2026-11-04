# 公開サイトのルートに置くファイルとエラーページ（設計）

GitHub Pages で公開するときに、`docs/` 直下に置きたいファイル（robots.txt・`.nojekyll`・CNAME 等）と
エラーページ（`docs/404.html`）を Binder から用意できるようにするための設計。

進め方は 2 段階。

1. **フェーズ1: アセットをサイトのルートに公開する** — 静的なファイル（robots.txt / `.nojekyll` / CNAME / sitemap.xml の手書き版 / 所有権確認ファイル）。**実装済み**
2. **フェーズ2: 404 ページ** — layout / content テンプレートで作るページを `docs/404.html` に出す

sitemap.xml の自動出力は後日（[将来](#将来-sitemapxml-の自動出力)）。

## 前提: GitHub Pages が特別扱いするもの

| ファイル | 役割 | 効く条件 |
|---|---|---|
| `404.html` | 存在しないパスにステータス 404 で返すページ。**中身を差し替えられるエラーページはこれだけ**（403 / 500 等は不可） | 公開元（`/` か `/docs`）の直下。プロジェクトサイトでは `/<repo>/` 以下のパスに効く |
| `index.html` | ディレクトリの既定ページ。`/foo` は `foo.html` も探す | — |
| `CNAME` | 独自ドメイン | ブランチから公開するとき。GitHub Actions で公開する場合は使われない |
| `.nojekyll` | Jekyll を止める。無いと `_` で始まるファイル・ドットファイルが公開されない | 公開元の直下 |

慣習として置かれるもの（GitHub Pages の特別扱いではない）:

| ファイル | 注意 |
|---|---|
| `robots.txt` | **ホストのルート（`https://host/robots.txt`）でしか読まれない**。プロジェクトサイト（`user.github.io/repo/`）では置いても効かない |
| `sitemap.xml` | 載せられる URL は**そのファイルがあるディレクトリ以下だけ**（sitemaps.org）。`docs/assets/sitemap.xml` だと `pages/` を載せられない。robots.txt の `Sitemap:` 行か Search Console から指定した場合はこの制約を受けない |
| `favicon.ico` | テンプレートの `<link rel="icon" href="{{ url "…" }}">` で足りる。ルートに置く必要は薄い |

サーバ側のリダイレクト（`_redirects` / `.htaccess`）・レスポンスヘッダ・Basic 認証は GitHub Pages では使えない。

### 「ルート」がサイトのルートにならない場合

`binder.json` の `publishOnly` + `publishSubDir`（docs だけを公開ブランチのサブディレクトリへ送る設定、
例: `en`）のときは、`docs/` 直下が公開ブランチの `en/` になる。
このとき `docs/404.html` と `docs/robots.txt` は GitHub Pages から見て特別なファイルではなくなる。
UI ではこれを警告する（後述）。

効くかどうかは既存の `SiteURL()`（[site_url.go](../site_url.go)）から判断できる。

| 判定 | 条件 |
|---|---|
| robots.txt が効く | `SiteURL()` のパスが `/`（独自ドメインかユーザサイト）、かつ `publishSubDir` が空 |
| 404.html が効く | `publishSubDir` が空 |
| 判定できない | `SiteURL()` が空。警告はせず、ヘルプの文言で伝える |

---

## フェーズ1: アセットをサイトのルートに公開する

実装済み。検証は `fs/alias.go`、公開先は `fs/path.go` の `publicAssetFile`、UI の判定は
`_cmd/binder/frontend/src/dialogs/rootAsset.js`。

### 表し方: alias の先頭の `/`

**alias が `/` で始まるアセットは、`docs/assets/` ではなく `docs/` 直下に公開する。**

| alias | 公開先 | 公開 URL（プロジェクトサイトの例） |
|---|---|---|
| `robots.txt` | `docs/assets/robots.txt` | `…/repo/assets/robots.txt`（従来どおり） |
| `/robots.txt` | `docs/robots.txt` | `…/repo/robots.txt` |
| `/.nojekyll` | `docs/.nojekyll` | — |

「alias は公開パス。`/` はサイトのルート」と読めるため、CSV を直接見る人（`binder-organize` スキル）にも意味が伝わる。

#### 列を足す案との比較

| | alias の `/`（採用） | `assets` に列（例: `root`）を足す |
|---|---|---|
| スキーマ移行 | 不要 | 要る（`setup/convert/db/` に移行を足す。ラベルの付け方の罠あり → `setup/convert/AGENTS.md`）。DAO の再生成も要る |
| 置き場所の切り替え | alias の変更と同じ。既存の `RenamePublishedAsset` が旧パスから新パスへ移すので、新しい処理は要らない | 列の変更でも公開済みファイルを移す処理を別に書く |
| alias の重複チェック | `robots.txt` と `/robots.txt` は別の alias として共存できる（公開先も別） | 同名を `assets/` とルートの両方に置けない（alias が同じになる） |
| 分かりやすさ | alias の意味が 1 文字で変わる | 列名で意味が明示される |

分かりにくさは UI のチェックボックス（後述）で補う。CSV の上でも `/robots.txt` は意味を読み取りやすい。

### 名前の規則

ルート用の alias は **`/` の後ろが 1 階層だけ**。

- 形式: `^/[A-Za-z0-9._-]+$`（先頭のドットは可。`.nojekyll` のため）
- 不可: `/.` `/..`、`/.git` で始まるもの
- サブディレクトリ（`/.well-known/…` 等）はフェーズ1では扱わない（[未決事項](#未決事項)）
- **予約名**（大文字・小文字を区別しない）: Binder が `docs/` 直下に出すもの

  | 予約名 | 理由 |
  |---|---|
  | `index.html` | index ノートの出力先 |
  | `404.html` | フェーズ2の出力先 |
  | `pages` `images` `assets` `layers` | Binder が使うディレクトリ |

  `fs/path.go` に `reservedPublicRootNames` として置き、`fs/rootfile.go` の `reservedRootNames` と同じ形で比較する。

#### 通常の alias も検証する（既存の穴）

いまは alias を何も検証していない。`filepath.Join("docs", "assets", alias)` に `../../x` のような alias を渡すと、
`docs/` の外（バインダーのルート）に書き出せてしまう。ルート公開を入れるのに合わせて、alias の検証を 1 か所にまとめる。

- 先頭の `/` を除いた残りに `/` `\` `..` を含まない
- 空は従来どおり許す（`PublicAssetFile` が `""` を返し、公開されない）

既存のバインダーにこの規則に合わない alias があった場合は、doctor（[doctor.go](../doctor.go)）で警告だけ出し、自動では直さない。
いま alias が `/` で始まるアセットは `docs/assets/x` に出ている（`filepath.Join` が `/` を詰める）。
フェーズ1以降は `docs/x` に移るので、同じく doctor で知らせる。どちらも実際にはほぼ無いはず。

### 変更箇所

URL の解決は `fs.PublicAssetFile` → `convertURL` を通っているので、**公開パスを `fs/path.go` 1 か所で変えれば
`assets` / `url` / `link` / `fullURL` / `assetsImage` は手を入れずに追従する**。
`pages/` のページから `/robots.txt` を指すと `../robots.txt`、index からは `./robots.txt` になる。

| ファイル | 変更 |
|---|---|
| `fs/path.go` | `publicAssetFile(alias)`: `/` 始まりなら `filepath.Join(publishDir, alias[1:])`。`IsRootAlias(alias)`、`ValidateAssetAlias(alias)`、`reservedPublicRootNames` を足す |
| `fs/asset.go` | 変更なし（`RenamePublishedAsset` / `PublishAsset` / `UnpublishAsset` / `DeleteAsset` は `publicAssetFile` を通る。`copyReader` が親ディレクトリを作る） |
| `asset.go` | `editAsset` / `DropAsset` / `AddTextAsset` で `ValidateAssetAlias` を呼ぶ。エラーはユーザ向けエラーにする（`_docs/skills/binder-user-error/SKILL.md`） |
| `api/error.go` | 不正な alias・予約名の alias を翻訳済みメッセージに変える（`go.error.invalidAlias` / `go.error.reservedAlias`） |
| `http.go` | `parseAliasFromPath`: `/` 直下の 1 階層のパスで既知の名前（`index.html` 等）でなければ、`{typ: "asset", alias: "/" + name}` を返す。プレビューサーバで未公開・非公開のページ（404 / 403）が既存の仕組みで出る。`ResolveLinkPath` も同じ関数を使うので、プレビュー内のリンクも解決できる |
| `download.go` | エクスポートの zip のパス `"assets/" + a.Alias` を、公開パスから `docs/` を除いたものに変える（`/robots.txt` → zip の直下） |
| `doctor.go` | 上記の alias の警告 |
| `asset.go` `detectMime` | 変更なし。`/robots.txt` → `text/plain`、`/sitemap.xml` → `text/xml`、拡張子の無い `/.nojekyll` `/CNAME` → `text/plain`（テキストとして編集できる） |

DB・`api/json`・バインディングには変更が無い。

### UI

**アセットのメタ情報ダイアログ**（`dialogs/AssetMetaDialog.jsx`）

- alias の下にチェックボックス「サイトのルートに置く」を置く。付け外しで alias の先頭の `/` を足し引きする（alias 欄と常に同期させる）
- 公開 URL を薄く表示する。`SiteURL()` が分かれば絶対 URL（`https://user.github.io/repo/robots.txt`）、分からなければ `docs/robots.txt`
- 効かない置き方のときは警告を出す（保存は止めない）
  - alias が `/robots.txt` で、サイトの URL のパスが `/` でない → 「プロジェクトサイトでは robots.txt は読まれません。独自ドメインかユーザサイトで公開したときに効きます」
  - `publishSubDir` が空でない → 「公開データはサブディレクトリ（{dir}）に送られるため、ここに置いたファイルはサイトのルートになりません」

警告の判定に要る値は既存の API で取れるため、API は足していない（バインディングの再生成も不要）。
サイトの URL は `GetConfig()` の `siteUrl`（空なら `siteUrlGuess`）、送信先のサブディレクトリは `GetPublishSettings()`。
サブディレクトリの警告が出るときは robots.txt の警告を重ねない。

**ツリー・未公開一覧**: アセットとして今までどおり並ぶ。ルートに置くアセットを見分けるバッジは付けていない（必要になったら足す）。

**新規作成の導線**: 既存の「テキストを追加」（`AddTextAsset`）で作り、alias を変える。
よく使うものを選んで作るメニュー（robots.txt / .nojekyll / CNAME の雛形）は便利だが、フェーズ1では入れない。

翻訳キー（`setup/_assets/languages/` の ja / en）: `asset.rootPublish` `asset.rootPublishTip` `asset.publishPath`
`asset.robotsIneffective` `asset.subDirIneffective` `go.error.invalidAlias` `go.error.reservedAlias`。
`asset.publishPath` は「公開先」というラベルだけで、URL は別の要素に出す。

### 使い方の例

| 作るもの | alias | 中身 |
|---|---|---|
| robots.txt | `/robots.txt` | `User-agent: *`<br>`Allow: /`<br>`Sitemap: https://example.com/sitemap.xml` |
| Jekyll を止める | `/.nojekyll` | 空 |
| 独自ドメイン | `/CNAME` | `example.com` |
| 手書きのサイトマップ | `/sitemap.xml` | XML |
| Search Console の所有権確認 | `/google0123abcd.html` | Google が指定する 1 行 |

CNAME をアセットで持つと、`GuessSiteURL()` がそれを読んでサイトの URL を推し量れる（いまは手で置いた `docs/CNAME` を読んでいる）。
GitHub のリポジトリ設定で独自ドメインを入れると、GitHub が公開元に `CNAME` をコミットすることがある。
その場合はアセットの公開で上書きされる（中身が同じなら差分は出ない）。

### テスト

| 対象 | 確かめること |
|---|---|
| `fs/path` | `PublicAssetFile` が `/x` → `docs/x`、`x` → `docs/assets/x` を返す。`ValidateAssetAlias` の表（`/robots.txt` 可、`/.nojekyll` 可、`/a/b` 不可、`../x` 不可、`/index.html` `/PAGES` 不可） |
| `asset_test.go` | ルートのアセットを公開すると `docs/robots.txt` ができ、取り下げると消える。alias を `robots.txt` ⇔ `/robots.txt` と変えると公開済みファイルが移る。予約名・不正な alias はエラーになる |
| `html_link_test.go` | `url` がページからは `../robots.txt`、index からは `./robots.txt` を返す。`fullURL` が `https://…/robots.txt` を返す |
| `http.go` | プレビューサーバで未公開のルートのアセットが 404 ページ、非公開が 403 ページになる |
| `download.go` | エクスポートの zip で、ルートのアセットが zip の直下に入る（`download_internal_test.go`） |
| フロントエンド | チェックボックスと alias 欄が同期する。警告の表示条件（`rootAsset.test.js` / `AssetMetaDialog.test.jsx`） |

Go 側のテストは `fs/alias_test.go` と `asset_root_test.go`。

---

## フェーズ2: 404 ページ

テンプレート（layout / content）を使って `docs/404.html` を作る。

### 表し方: ノートの alias `/404`

フェーズ1と同じ「`/` はサイトのルート」の規則をノートにも当てる。**alias が `/404` のノートは `docs/404.html` に出す。**

- ノートで許すルートの alias はフェーズ2では `/404` だけにする。他の名前を許しても GitHub Pages では意味が無く、URL の基準の扱いが増えるだけのため
- 本文は Markdown で書け、layout / content テンプレートも普通のノートと同じように選べる
- `fs.HTMLFile(note)`: `index` と同じ並びで、alias が `/404` なら `docs/404.html` を返す
- `parseAliasFromPath` / `ResolveLinkPath`: `/404.html` を alias `/404` のノートとして解決する

### URL の基準（一番の要点）

404.html は利用者がアクセスした URL のまま返される（`/repo/pages/a/b/x.html` へのアクセスに 404.html の中身が返る）。
相対パスでは CSS もリンクも壊れるため、**404 ページを公開するときだけ、`relativePrefix()` がサイトのルートからの絶対パスを返す**。

| 場面 | `relativePrefix()` | 例 |
|---|---|---|
| index | `./` | `./assets/styles.css` |
| pages/ | `../` | `../assets/styles.css` |
| 404（公開） | `SiteURL()` のパス | `/repo/assets/styles.css` |
| 404（プレビュー、`Local`） | `./` | プレビューはアセットが data URI なので相対で足りる |
| 404（公開、サイトの URL が不明） | `./` + 公開時に警告 | 1 階層目の 404 では表示が崩れない |

`.Home.Link` `.Note.Link` `url` `link` `assets` `childNotes` の `.Link` はすべて `convertURL` → `relativePrefix` を通るため、ここ 1 か所で揃う。
フルの URL（`https://…`）ではなくパス（`/repo/`）にするのは、http / https や独自ドメインの付け外しの影響を受けないため。
`fullURL` は `page = "404.html"` として既存の処理で絶対 URL を作れる。

### 一覧から外す

404 ノートはツリーに置かれる普通のノートなので、そのままだと一覧に出てしまう。次から除く。

- `childNotes` / `childrenNotes` / `latestNotes` / `prevNote` / `nextNote` / `breadcrumb`
- 将来の sitemap.xml の自動出力

除外の判定は「alias が `/404`」の 1 か所（例: `json.Note.IsErrorPage()`）にまとめる。

### プレビューサーバ

公開の確認用サーバ（`http.go` の `serveWithAliasCheck`）で、見つからないパスに `docs/404.html` を 404 で返すと GitHub Pages の動きに近くなる。
ただしプレビューサーバは docs を `/` に置いているので、`/repo/` で始まる絶対パスはそのままでは解決できない
（[未決事項](#未決事項)）。

### UI

- ノートのメタ情報ダイアログに「このノートを 404 ページにする」（alias を `/404` にする）。バインダーに 1 つだけ（alias の重複チェックで自然に 1 つになる）
- フェーズ1と同じく、`publishSubDir` があるときは「効かない」と警告する
- サイトの URL が分からないまま公開したときは、公開時の警告（既存の `fullURL` と同じ仕組み）

---

## 将来: sitemap.xml の自動出力

- 公開時に、公開中のノート（非公開・404 ノートを除く）から `docs/sitemap.xml` を作る。`<loc>` は `fullURL` と同じ規則、`<lastmod>` は `Republish`
- 絶対 URL が要るので、サイトの URL が分からないときは作らずに警告する
- 有効にしたら `/sitemap.xml` を予約名に加える（手書きのアセットとぶつかるため）
- robots.txt の `Sitemap:` 行は利用者が書く（フェーズ1のアセット）

## 未決事項

| 項目 | 選択肢・メモ |
|---|---|
| サブディレクトリ（`/.well-known/…`） | フェーズ1では不可。要るなら alias の `/` の後ろに 2 階層以上を許すが、予約名との衝突・`RenamePublishedAsset` で空になったディレクトリの後始末を考える |
| プレビューサーバでの 404 | ① 404 だけ相対パスで出し直して返す ② サーバがサイトのパス（`/repo/`）でも docs を返す ③ 扱わない |
| 404 用のプリセットテンプレート | 同梱の content テンプレートに「エラーページ」を足すか。新規バインダーにだけ入るので、既存のバインダーには届かない |
| ルートのアセットの雛形メニュー | robots.txt / .nojekyll / CNAME を選んで作る導線。フェーズ1の後で使われ方を見て決める |
