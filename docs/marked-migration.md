# marked バージョン移行計画

marked.js のバンドルバージョンを段階的に更新するための計画と、そのために必要な
「プラグイン互換基盤」の設計をまとめる。mermaid の更新（11.14.0 → 11.16.0、0.13.1）は
破壊的変更がなく完了済み。marked は事情が異なるため本ドキュメントで管理する。

このファイルの位置づけ: **これから実装する計画**。実装が進んだら各段階に実装済み印を
付け、完了後は履歴として残す（`setup/convert/HISTORY.md` と同じ扱い）。

作成時点の状態: バンドル marked **14.1.4** / mermaid 11.16.0、アプリバージョン **0.13.1**。

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
   - extension の `tokenizer`（→ undefined）/`renderer`（→ 空文字）/`walkTokens`、
     トップレベル `renderer.*` を try/catch でラップ。投げたプラグインは名指しで
     `getPluginStatus()` に `runtimeError` を記録し、プレビュー全体は落とさない。

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

### 0.15.0 — marked 17.0.5

- vendor バンドル差し替え×2（binder / lite）。v16 以降 `lib/marked.esm.js` は minify
  済みなので約 92KB → 約 42KB に減る
- v15/v16 は alt 属性リグレッションのため素通りして直接 17 へ
- **ライセンスは変更不要**（実測確認済み）: marked の LICENSE の著作権表記は v14/v17/v18 で
  同一（`## Marked`: MarkedJS + Christopher Jeffrey / `## Markdown`: John Gruber 2004）。
  なお `## Markdown`（John Gruber, BSD系）ブロックは v14 時点で既に存在しており、
  当初 `THIRD_PARTY_LICENSES` に欠けていたため 0.14.0 で補完済み。ミニファイ版ヘッダの
  年号（v14=2011-2024 / v17+=2018-2026）は表記が違うが正典の LICENSE は一致
- `Binder.jsx` の CDN URL プレースホルダを更新
- 0.14.0 の回帰テストで v17 の list トークン変更の影響を確認

### 0.16.0 — marked 18.0.7

- vendor バンドル差し替えのみ（実測上コード変更は不要な見込み）
- v18 の「末尾空行トリム」は `parseWithSourceLines` の行マッピングに影響しないことを
  実測済み（`token.raw` の round-trip は v18 でも一致）

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
  互換ゲート・エラー隔離、`binder.escape` 提供
- `_cmd/binder/frontend/src/main.jsx` — `GetPlugins` 適用時に marked バージョンを解決
- `setup/_assets/plugins/marked/*.js` — `@marked` 付与、エスケープ問題4本の修正
- `setup/externals.go` — `InstallSamplePlugins` をハッシュ一致時のみ上書きに
- `_cmd/binder/frontend/src/dialogs/PluginSetting.jsx` / `AppPluginSetting.jsx` —
  対応marked / 現在のmarked / 状態の表示
- テスト — 同梱プラグイン回帰テスト（vitest）

詳細なプラグイン実装マップは Skill: `binder-plugin-rootfile` を参照。

---

## 決定事項（0.14.0 実装方針）

1. **バインダー内プラグイン（git管理・チーム共有）は自動更新しない** — ランタイム互換層
   （バージョン注入・`@marked`ゲート・エラー隔離）で実行時に吸収し、設定画面に状態を
   表示する。git にコミット済みの共有内容を移行が書き換えるのは不可とする。
   同梱プラグインの更新機構（item 7）が触るのはアプリ階層（`~/.binder/plugins/marked/`）のみ。
2. **`@marked` 未宣言プラグインは警告付きで適用** — 後方互換優先。検証時メジャーを記録し、
   現在の marked と不一致なら「動作未確認」と警告表示する（スキップはしない）。
3. **同梱4本のエスケープ修正（kbd/sub/sup/underline）は 0.14.0 に含める** — XSS のため。
   回帰テストも同時に入れる。
4. メタデータ書式は既存の `/* @key: value */` 行並びを踏襲（`@plugin-name` は既に存在）。
5. 「検証時メジャーの記録」は入れる（item 3）。
