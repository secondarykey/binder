# marked バージョン移行計画

marked.js のバンドルバージョンを段階的に更新するための計画と、そのために必要な
「プラグイン互換基盤」の設計をまとめる。mermaid の更新（11.14.0 → 11.16.0、0.13.1）は
破壊的変更がなく完了済み。marked は事情が異なるため本ドキュメントで管理する。

このファイルの位置づけ: **これから実装する計画**。実装が進んだら各段階に実装済み印を
付け、完了後は履歴として残す（`setup/convert/HISTORY.md` と同じ扱い）。

作成時点の状態: バンドル marked **14.1.4** / mermaid 11.16.0、アプリバージョン **0.13.1**。

現在の状況: **0.14.0（互換基盤）と 0.15.0（marked 17.0.5 への差し替え）は実装完了**。
バンドルは 17.0.5。残るのは 0.16.0（marked 18.0.7）の vendor 差し替え。

---

## 背景と問題

### 1. 下位互換は保証されない（実測で確認済み）

marked は minor / major で描画結果とトークン構造を変えることがある。node で
v14.1.4 / v15.0.12 / v16.4.1 / v17.0.5 / v18.0.7 を並べて実測した結果:

- **v15: コア renderer に渡る `token.text` が未エスケープに変わった**
  ```
  codespan の token.text
    v14: "a &amp; &lt;b&gt;"   (エスケープ済み)
    v15〜: "a & <b>"           (生)
  ```
  v14 時代に `renderer:{ codespan(t){ return '<code>'+t.text+'</code>' } }` と
  書いたプラグインは、v15 以降そのまま生 HTML を出力する（XSS）。

- **v17: `list_item` のトークン構造が変わった**
  ```
  task list の list_item の子トークン
    v14〜16: [text]
    v17〜:   [checkbox, text]   (checked が子トークンへ)
  loose list の item の子トークン
    v14〜16: [text]
    v17〜:   [paragraph]        (型が変わる)
  ```
  `item.tokens[0].type === 'text'` に依存するプラグインは v17 で分岐が外れる。

- **marked 本体の v15 リグレッション**: 画像 alt 属性が v15/v16 でエスケープされず
  属性を突破する（`![a" onerror="x](u)`）。v17 で修正。**このため v15/v16 は
  経由リリースとしても採用しない**。

**いずれも例外を投げず、静かに間違った出力になる。** そのためエラー捕捉だけでは
検出できない。

### 2. ユーザは任意バージョンで動かせる

バンドル版（デフォルト）が 14 でも、ユーザはバインダー設定の CDN URL に任意の
marked を指定できる（`fs/meta.go` の `MarkedURL`）。つまり**今この瞬間も v18 で
動かしているユーザがいる可能性がある**。バンドルを上げる/上げないに関わらず、
プラグインがバージョン差を吸収できる必要がある。

### 3. marked はランタイムにバージョンを公開していない

`marked.version` は v14〜v18 すべてで `undefined`。version 系の export も無い。
そのため「今動いている marked は何か」は次の三段構えで判定する。

| 経路 | 判定方法 | 確度 |
|---|---|---|
| バンドル版 | vendor 差し替え時に定数として埋め込む | 確実 |
| CDN URL | URL から `/marked@(\d+\.\d+\.\d+)/` をパース | 高（慣例URLなら） |
| 上記不明 | 機能プローブ | メジャー単位で判定可 |

機能プローブ（実測で確認済み・メジャー境界を切り分けられる）:
```js
// v17 以降: list_item の子に checkbox トークンが生成される
Lexer.lex('- [ ] a\n')[0].items[0].tokens[0].type === 'checkbox'
// v14 か v17+: alt 属性がエスケープされる（v15/16 は false）
marked('![a"x](u)').includes('&quot;')
```
この2つで `<15` / `15-16` / `>=17` を確実に区別できる。パッチレベルまでは不明だが
互換ゲートにはメジャーで十分。

### 4. 「保証」できることの範囲

`@marked` レンジは**作者の自己申告**であり、動作の証明ではない。各仕組みが
実際に担保できるのは以下の切り分けにとどまる。

| 仕組み | 防げること |
|---|---|
| `@marked` 互換ゲート | 作者が「非対応」と分かっている組み合わせで動いてしまうこと |
| バージョン注入 | プラグインが差異を吸収する術を持たないこと |
| エラー隔離 | 例外を投げる壊れ方でプレビュー全体が落ちること |
| 検証時メジャーの記録 | 未宣言プラグインが黙って環境変化にさらされること |
| **回帰テスト** | **同梱プラグインの silent breakage（唯一これだけが実証できる）** |

エラー隔離には裏がある。**握り潰した事実を表に出さない限り、隔離は「壊れていることを
隠す仕組み」になる**。そのため隔離と可視化（プレビューの警告バー・設定画面の状態表示・
出力時の警告）は必ずセットで入れる。0.14.0 の item 4 と item 9 以降がその対。

silent breakage を本当に捕まえられるのは回帰テストだけ。同梱プラグインについては
テストで「動作保証」と呼べる状態を作り、ユーザ自作プラグインについては同じ
テストの書き方をドキュメント化する。

---

## リリース計画

### 0.14.0 — 互換基盤（**marked のバンドルは 14.1.4 のまま変更しない**）

バンドルのエンジン本体は一切触らず、「バージョン差を扱える仕組み」だけを入れる。
順序が要点で、バンドルを上げる前に「上げても壊れたと分かる／プラグインが差を
吸収できる」状態を先に作る。この基盤は、既に CDN で v18 にしているユーザを
今すぐ救う意味も持つ。

進捗記号: ✅ 実装済み / ⬜ 未着手

1. ✅ **バージョンコンテキストの注入** — プラグイン eval 前に `globalThis.binder` を用意
   （`_cmd/shared/frontend/editor/engines/Marked.jsx` の `installBinderContext`）
   ```js
   globalThis.binder = {
     marked: {
       version: "14.1.4",   // 判明時。CDN で不明なら null
       major: 14,           // 常に取れる（不明時は機能プローブ）
       source: "vendor",    // "vendor" | "cdn"
       satisfies(range) { ... },
     },
     escape(str) { ... },   // v15 以降プラグイン責任になった正しいエスケープを提供
   };
   ```
   既存プラグインは `binder` を参照しないので影響を受けない（opt-in）。
   marked バージョンは vendor 定数（各 main.jsx の `setVendorVersion`）→ CDN URL の
   `marked@x.y.z` パース → 機能プローブ（`Marked.probeMajor`）の三段構えで解決する
   （`resolveMarkedInfo`）。

2. ✅ **`@marked` メタデータのパースと互換ゲート** — 判定は JS 側で完結
   （`_cmd/shared/frontend/editor/pluginMeta.js`）。フロントエンドは既に plugin の
   `content` を受け取るため、Go 側の parse を追加せず JS で一元化した。
   - `parsePluginMeta` が先頭コメントから `@plugin-name`/`@plugin-version`/`@marked` を抽出
   - `satisfiesRange` が `>= > <= < =`・空白区切り AND・演算子なし整数（メジャー一致）を判定
     （`^`/`~` は非対応）
   - `pluginCompatStatus` が compatible / incompatible / undeclared / unverified / unknown を返す

3. ✅ **検証時メジャーの記録と差異警告** — 未宣言プラグインの扱い
   - 永続化: `settings.PluginVerified`（`setting.json`）にバインダーのディレクトリパスで
     スコープして `{ "engine/name": major }` を保持（git 管理外・ローカル観測値）。
     `settings/plugin_verified.go`、`binder.go` の `Get/SetPluginVerified`、
     `api/plugin.go` の `GetPluginVerifiedMajors`/`SetPluginVerifiedMajor`
   - 記録タイミング: `PluginSetting.jsx` で追加・更新・インストール成功時に、その時の
     marked メジャー（`Marked.getMarkedInfo().major`）を記録。削除・リネームは Go 側で追随
   - 適用時: `main.jsx` が `GetPluginVerifiedMajors` を取得し `applyPlugins` の第3引数へ渡す

   | 状況 | 挙動 |
   |---|---|
   | `@marked` 宣言あり・満たす | 有効（compatible） |
   | `@marked` 宣言あり・満たさない | **スキップ**（incompatible。理由を明示） |
   | `@marked` 宣言あり・marked 不明 | 有効（unknown・警告） |
   | 未宣言・記録メジャーと一致 | 有効（compatible） |
   | 未宣言・記録メジャーと不一致 | 有効（unverified・「動作未確認」警告） |
   | 未宣言・記録なし | 有効（undeclared） |

4. ✅ **プラグイン実行エラーの隔離** — `applyPlugins` → `_isolateExt`
   - extension の `tokenizer`（→ undefined）/`renderer`（→ `token.raw`）/`walkTokens`、
     トップレベル `renderer.*` を try/catch でラップ。投げたプラグインは名指しで
     `getPluginStatus()` に `runtimeError` を記録し、プレビュー全体は落とさない。
   - 隔離は単体では検知性を下げるため、可視化（item 9 以降）とセットで入れる。

5. ✅ **同梱プラグインの修正**（`setup/_assets/plugins/marked/`）
   - 全15本に `@marked: >=14 <19` を付与
   - **エスケープ問題の修正（実測で確認済み・5本）**: `token.text` を生で埋めているため、
     中身の特殊文字（`&`/`<`）がエスケープされず不正な HTML を出力していた。
     対象は **kbd / subscript / superscript / underline / highlight**（当初 4 本と報告したが、
     実装時に highlight も同型と判明し追加）。
     ```
     修正前: [[Ctrl & C]] → <kbd>Ctrl & C</kbd>    （& が生・不正）
     修正後: [[Ctrl & C]] → <kbd>Ctrl &amp; C</kbd>（+ [[**b**]] も効く）
     ```
     **注意（当初報告の訂正）**: この問題は v15 特有ではなく **v14〜v18 で同一挙動**。
     v15 で変わったのは*コア* renderer 上書き時の `token.text`（`codespan` 等）であり、
     これらのカスタム拡張はコア renderer を使わないため無関係だった。修正は
     tokenizer で `this.lexer.inline(text, token.tokens)` を作り renderer で
     `this.parser.parseInline(token.tokens)` する形（`**強調**` も効くようになる）。

6. ✅ **同梱プラグインの回帰テスト** — バンドル marked 実体に対して全15本を適用する
   vitest（`_cmd/binder/frontend/src/__tests__/bundledPlugins.test.jsx`）。加えて
   互換層の単体テスト（`pluginMeta.test.jsx`）と、ゲート・エラー隔離・コンテキスト注入の
   統合テスト（`markedCompat.test.jsx`）。

7. ✅ **配布済みプラグインの更新機構** — `setup/plugin_sync.go` の `SyncSamplePlugins()`。
   各同梱プラグインについて、ユーザの `~/.binder/plugins/marked/<file>` のハッシュが
   **Binder が配布した既知ハッシュ集合（過去バージョン + 現行同梱版）に一致する場合のみ**
   最新版で上書きする。ユーザ編集ファイル・削除済みファイルは触らない。既知ハッシュは
   `shippedPluginHashes`（過去分をハードコード）+ 実行時算出の現行ハッシュ。
   `migrateApp` の `needUpdate` 時に毎回実行。**アプリ階層のみが対象**で、バインダー内
   プラグイン（git 管理）は決定事項どおり触らない。
   - 同梱プラグインを更新するたびに、直前バージョンの sha256 を `shippedPluginHashes` に
     追記すること（これを忘れると、その版を持つユーザが「編集済み」扱いになり更新されない）

8. ✅ **設定画面での互換状態表示** — `PluginSetting.jsx` にプラグインごとの状態ドット
   （色）+ ツールチップ（状態 / 対応marked / 現在のmarked）を表示。incompatible /
   unverified はセカンダリラベルも出す。marked 情報は `Marked.ensureInit()` →
   `getMarkedInfo()`、判定は `pluginCompatStatus`。i18n: `plugin.compat.*`。

#### 失敗の可視化（エラー隔離とセットで入れる）

エラー隔離（item 4）は**単体で入れると検知性を下げる**。握り潰す仕組みだけあって、
握り潰した事実をユーザに見せる経路が無いと、0.13.2 より気付きにくくなる:

| | 0.13.2（隔離なし） | 隔離のみ入れた場合 |
|---|---|---|
| プラグインが実行時に例外 | `marked.marked()` から伝播 → プレビューがエラー表示 / 出力時にエラー | `_isolateExt` が捕捉 → 記法が黙って消え、プレビューは "Success" |
| 出力（publish） | エラーで止まる | 成功し、劣化した HTML が git に記録される |

`Marked.getPluginStatus()` は `applied` / `loadError` / `runtimeError` を保持しているが、
UI から参照しなければ意味を持たない。`console.warn` は Syslog ウィンドウにも出ない
（あれは Go の slog を tail するだけで JS → Go のログ橋渡しは無い）ため、
F12 を開かない限り気付く手段が無くなる。

**0.15.0/0.16.0 でバンドルを上げる前に、この経路を塞いでおく必要がある**ため、
item 9 以降を同じリリースに含める。

9. ✅ **プラグイン警告をプレビューの警告バーへ出す** — `Marked.getPluginWarnings(t)` を新設し
   （`_cmd/shared/frontend/editor/engines/Marked.jsx`）、`Component.jsx` の `createMarked` が
   返す `warnings` に連結する。既存の parseStatusBar（「Warning (n)」＋一覧ダイアログ）に
   そのまま乗るため、**ノートを開いているだけで気付ける**。
   拾う状態は loadError / incompatible / notApplied / runtimeError。
   i18n: `plugin.warn.*`。翻訳関数を渡さない場合・キー未定義時は英語の既定文言に落ちる
   （Lite など i18n を持たない呼び出し元でも使えるようにするため）。

10. ✅ **renderer 失敗時のフォールバックを `''` → `token.raw`（エスケープ済み）に変更** —
   空文字だと記法もろとも消えて異常と分からないが、生ソースが残れば目視で気付ける。
   tokenizer 側は元から `undefined`（＝マッチせず素のテキストが残る）で同じ性質だったため、
   renderer だけが非対称だった。

11. ✅ **設定画面の状態表示に実測を反映** — `PluginSetting.jsx` の状態判定に
   `Marked.getPluginStatus()` を重ね、`loadError` / `runtimeError` / `notApplied` を
   赤ドット＋セカンダリラベルで出す。従来は宣言（`@marked`）と検証記録だけで判定しており、
   「設定画面は緑なのに動いていない」状態が表現できなかった。

12. ✅ **出力時の警告** — publish（`handlePublish` / `UnpublishedMenu` の一括出力）で
   プラグイン警告がある場合、成功スナックバーではなく警告を出す。
   出力 HTML は git に記録されるため、劣化したまま記録したことに気付ける必要がある。

13. ✅ **CDN 差し替え時にプラグインが落ちるバグの修正** — `Binder.jsx` の `handleSaveScript` は
   `loadAndValidate()` でエンジン実体を差し替えるだけで、`resolveMarkedInfo` も
   `applyPlugins` も呼んでいなかった。`isExists()` が true になるため `ensureInit()` も
   素通りし、**バインダー設定で marked URL を保存した瞬間からプラグインが一本も効かない**
   状態がアプリ再起動まで続いていた（その間に出力すると劣化 HTML が記録される）。
   検証後に `reset()` → `ensureInit()` で init 経路をやり直す。
   併せて `_pluginsApplied` フラグを持たせ、「エンジンを差し替えたまま再適用していない」
   状態自体を `getPluginWarnings` が検出できるようにした（同種の再発に対する保険）。

14. ✅ **バージョン判定の精度改善** — CDN URL の正規表現が `marked@x.y.z` 固定で、
   `marked@18` / `marked@18.0`（CDN で有効な形）を読み取れず機能プローブに落ちていた。
   1〜3 要素を許容し、パッチまで揃っている時だけ `version` として扱う
   （部分指定はメジャーのみ確定させ `version` は null のままにし、`>=18.1` 等の誤判定を防ぐ）。
   また `probeMajor` が v18 を 17 と判定していたため、v18 判別プローブを追加した
   （v18 は見出し直後の空行が独立した `space` トークンになる。v14/17/18 実測で確認）。

15. ✅ **CDN 読込失敗（ベンダー版へのフォールバック）を可視化** — CDN 指定は
   「バンドルを上げても壊したくないユーザがバージョンを固定する手段」として機能するが
   （`markedUrl` は `binder.json` = git 管理なのでチーム全員に効く）、読み込めなかった場合は
   `console.warn` だけでベンダー版へ落ちていた。**固定したつもりで新しい marked が動く**
   状態になり、しかも設定画面は URL 由来の版を表示し続けるため成功したように見えていた。
   - `Marked.setEngineRequest({url, blocked})` で「何を読もうとしたか」を記録し、
     `getEngineWarnings()` が「指定あり かつ 実際は vendor」を検出する。
     許可CDN外で弾いた場合は別文言（`marked.warn.cdnBlocked`）。
   - プレビュー・出力は `getWarnings()`（エンジン + プラグイン）を使う。
   - `Binder.jsx` の `renderVersionInfo` を URL 文字列ベースから **実際の解決結果ベース**へ
     変更。失敗時は「読み込めず内蔵版で動作中」を赤字で出す。未保存の編集中 URL は
     「未保存・保存時に読み込みます」と区別する。

**既知の制限（未対応）**: `tryLoadUrl` は ESM を先に試すが、UMD ファイルは import/export を
持たないため `import()` が**構文エラーにならず成功してしまう**。marked の UMD ラッパーは
`globalThis.marked` を正しく作るのに、直後に `globalThis.marked = m`（空の名前空間）で
上書きして壊す。`import()` が投げないので UMD 用の `Scripter.loadScript` へは到達しない。
**CDN 指定は `.esm.js` を使うこと**（`lib/marked.umd.js` は動かない）。

テスト: `_cmd/binder/frontend/src/__tests__/pluginVisibility.test.jsx`（警告の発生条件・
raw フォールバック・CDN フォールバック検出・URL バージョン解決）、
`PluginSetting.test.jsx`（実行結果の表示）、`Binder.test.jsx`（バージョン表示が
URL ではなく実際の解決結果に従うこと）。

### vendor バンドル差し替えチェックリスト（0.15.0 / 0.16.0 共通）

新しいセッションでもこの手順どおりに進めれば完了できる。

1. `npm i marked@<version>` して `node_modules/marked/lib/marked.esm.js` を取得。
   v16 以降このファイルは minify 済みなので、そのまま
   `_cmd/binder/frontend/src/assets/vendor/marked.min.js` と
   `_cmd/lite/frontend/src/assets/vendor/marked.min.js` に上書きコピーする（2箇所）。
   現行バンドルの構造（ESM。`Scripter.import` で読み `globalThis.marked` に代入）に合う。
2. **バージョン定数を更新（忘れやすい）**:
   - `_cmd/binder/frontend/src/main.jsx` の `MARKED_VENDOR_VERSION`
   - `_cmd/lite/frontend/src/main.jsx` の `Marked.setVendorVersion('...')`
3. `_cmd/binder/frontend/src/dialogs/Binder.jsx` の CDN URL プレースホルダの
   `marked@x.y.z` を更新。
4. **同梱プラグインが新バージョンで無傷か回帰テストで確認**:
   `cd _cmd/binder/frontend && npx vitest run src/__tests__/bundledPlugins.test.jsx`
   （バンドル実体を読むので、差し替え後の marked に対して検証される）。
5. 影響調査は throwaway スクリプトで再現可能（このセッションでは scratchpad で実施）。
   `npm i marked@14 marked@17 marked@18` を並べ、代表 Markdown と全15プラグインの
   出力を版間で diff する方式。commit 済みの回帰テストがあるので必須ではない。
6. `vite build`（binder / lite 両方）+ `npx vitest run`（全体）+ `task dev` で
   プレビュー描画と公開 HTML を目視確認（自動テストで拾えない領域）。
7. ライセンスは **変更不要**（下記参照）。

### 0.15.0 — marked 17.0.5（✅ 実装済み）

- 上記チェックリストに従い vendor を 17.0.5 へ差し替え済み（92,815B → 41,622B）。
  binder / lite 両方の `src/assets/vendor/marked.min.js` を `lib/marked.esm.js` で上書きし、
  バージョン定数（`MARKED_VENDOR_VERSION` / `setVendorVersion`）と `Binder.jsx` の
  CDN プレースホルダも 17.0.5 に更新。
  なお v17 の `marked.esm.js` は末尾に `//# sourceMappingURL=marked.esm.js.map` を持つが、
  `.map` は同梱しないため 1 行だけ除去してある（残すと devtools が 404 を引く）。
- v15/v16 は alt 属性リグレッションのため素通りして直接 17 へ。
- 差し替え後の実測（バンドル実体に対して確認済み）:
  ```
  Lexer.lex('- [ ] a\n')[0].items[0].tokens[0].type === 'checkbox'   // >=17
  marked('![a"x](u)').includes('&quot;') === true                     // v15/16 ではない
  Lexer.lex('# h\n\ntext\n').map(t => t.type) === ['heading','paragraph'] // v18 ではない
  ```
  `probeMajor` が 17 と判定できる状態（CDN 版が不明なユーザ経路の保険）。
- **ライセンスは変更不要**（実測確認済み）: marked の LICENSE の著作権表記は v14/v17/v18 で
  同一（`## Marked`: MarkedJS + Christopher Jeffrey / `## Markdown`: John Gruber 2004）。
  なお `## Markdown`（John Gruber, BSD系）ブロックは v14 時点で既に存在しており、
  当初 `THIRD_PARTY_LICENSES` に欠けていたため 0.14.0 で補完済み。ミニファイ版ヘッダの
  年号（v14=2011-2024 / v17+=2018-2026）は表記が違うが正典の LICENSE は一致。
- v17 の list トークン構造変更（checkbox 子トークン追加・loose list が paragraph 型）は
  同梱15本の出力に影響しないことを実測済み。差し替え後に `bundledPlugins.test.jsx`（23件）が
  全てパスすることで再確認した。フロントエンド全体（76ファイル・217件）もパス。
- **コード変更は vendor とバージョン定数のみ**。エンジン層・プラグイン本体には手を入れていない。

### 0.16.0 — marked 18.0.7

- 上記チェックリストに従い vendor を 18.0.7 へ差し替え。実測上、追加のコード変更は不要な見込み。
- v18 の「末尾空行トリム」は `parseWithSourceLines` の行マッピングに影響しないことを
  実測済み（`token.raw` の round-trip は v18 でも一致）。
- ライセンス変更不要（v18 の LICENSE も v14/v17 と同一）。

---

## バンドル生成手順（vendor 差し替え時の参考）

esbuild で IIFE 形式にバンドルする（mermaid 更新時に確立した手順と同型）。
marked は v16 以降 `lib/marked.esm.js` 自体が minify 済みなので、そのまま
`_cmd/{binder,lite}/frontend/src/assets/vendor/marked.min.js` に置く方式でも良い。
現行バンドルの構造（`globalThis.marked` に ESM の名前空間を代入）に合わせること。

差し替え後は必ず:
- binder / lite 両方の `vite build`
- binder フロントエンドの vitest（プラグイン回帰テスト含む）
- `task dev` でプレビュー描画と公開 HTML を目視確認（自動テストで拾えない領域）

---

## プラグインの書き方ガイドライン

同梱15本が v14→v18 で無傷だったのは、**トークンを自前で HTML 化せず parser に
委譲していたから**（実測で確認）。これがそのままガイドラインになる。

**推奨**
```js
// parser に委譲する。エスケープ仕様の変更に影響されない
renderer: function(token) {
  return '<div>' + this.parser.parse(token.tokens) + '</div>';        // ブロック
}
renderer: function(token) {
  return '<span>' + this.parser.parseInline(token.tokens) + '</span>'; // インライン
}
```

**避ける**
```js
// token.text を直接埋める。カスタム拡張トークンは marked がエスケープしない
renderer: function(token) { return '<kbd>' + token.text + '</kbd>'; }
```

原則:
1. トークンの中身は `this.parser.parse()` / `parseInline()` に通す
2. どうしても文字列を直接埋めるなら自前でエスケープ（`binder.escape()`）。特に
   属性値は `"` のエスケープ必須
3. `token.raw` の内容やトークン構造に依存しない（v17 の checkbox トークン追加、
   v18 の末尾空行トリムのような変更を受ける）
4. コア renderer（`heading`/`blockquote`/`codespan` 等）を上書きする場合、v15 以降
   `token.text` が**エスケープ前**で渡ることを前提に書く
5. バージョン差を吸収する必要があれば `binder.marked.major` / `satisfies()` で分岐
6. `@marked` レンジを宣言する

### プラグインメタデータ書式

先頭のコメント行で宣言する（`/* @key: value */` の行並び）。
```js
/* @plugin-name: Keyboard Tag ([[Key]]) */
/* @plugin-version: 1.0.0 */
/* @marked: >=14 <19 */
(function() { ... })();
```
- `@marked` は semver レンジ。`>= > <= < =` を空白区切り AND のみ。
- 現状 `@plugin-name` は書かれているが読むコードが無い（名前はファイル名由来）。
  0.14.0 でメタデータを正式にパースする。

---

## 実装マップ（触るファイル）

- `fs/plugin.go` — `PluginInfo` に `Version`/`MarkedRange`、`ReadPlugins` でヘッダパース
- `internal/version.go` — semver レンジ判定（既存 `Version` を利用）
- `_cmd/shared/frontend/editor/engines/Marked.jsx` — `applyPlugins` にバージョン注入・
  互換ゲート・エラー隔離、`binder.escape` 提供、`getWarnings`/`getPluginWarnings`/
  `getEngineWarnings`（可視化の入口）、`setEngineRequest`
- `_cmd/binder/frontend/src/main.jsx` — `GetPlugins` 適用時に marked バージョンを解決、
  `setEngineRequest` で要求 URL を記録
- `_cmd/binder/frontend/src/components/editor/Component.jsx` — `createMarked` が
  `getWarnings()` を warnings に連結（プレビューの警告バー）、出力時の警告
- `_cmd/binder/frontend/src/dialogs/Binder.jsx` — CDN 保存後の再初期化、
  バージョン表示を実際の解決結果ベースに
- `setup/_assets/plugins/marked/*.js` — `@marked` 付与、エスケープ問題5本の修正
- `setup/externals.go` / `setup/plugin_sync.go` — 配布済みプラグインをハッシュ一致時のみ上書き
- `_cmd/binder/frontend/src/dialogs/PluginSetting.jsx` / `AppPluginSetting.jsx` —
  対応marked / 現在のmarked / 状態の表示（実行結果込み）
- 言語ファイル — `plugin.compat.*` / `plugin.warn.*` / `marked.warn.*` / `binder.version*`
- テスト — `bundledPlugins` / `markedCompat` / `pluginMeta` / `pluginVisibility` /
  `PluginSetting` / `Binder`（vitest）

詳細なプラグイン実装マップは Skill: `binder-plugin-rootfile` を参照。

---

## 決定事項（0.14.0 実装方針）

1. **バインダー内プラグイン（git管理・チーム共有）は自動更新しない** — ランタイム互換層
   （バージョン注入・`@marked`ゲート・エラー隔離）で実行時に吸収し、設定画面に状態を
   表示する。git にコミット済みの共有内容を移行が書き換えるのは不可とする。
   同梱プラグインの更新機構（item 7）が触るのはアプリ階層（`~/.binder/plugins/marked/`）のみ。
2. **`@marked` 未宣言プラグインは警告付きで適用** — 後方互換優先。検証時メジャーを記録し、
   現在の marked と不一致なら「動作未確認」と警告表示する（スキップはしない）。
3. **同梱5本のエスケープ修正（kbd/subscript/superscript/underline/highlight）は 0.14.0 に
   含める** — XSS のため。回帰テストも同時に入れる。
4. メタデータ書式は既存の `/* @key: value */` 行並びを踏襲（`@plugin-name` は既に存在）。
5. 「検証時メジャーの記録」は入れる（item 3）。
6. **エラー隔離と可視化はセットで入れる（分割リリースしない）** — 隔離だけを出すと
   0.13.2 より検知性が下がる期間ができる。当初 0.14.1 として切り出す案もあったが、
   0.14.0 が未リリースだったため同一リリースへ統合した。
