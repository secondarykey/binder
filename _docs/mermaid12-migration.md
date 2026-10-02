# mermaid 12 移行計画

同梱 mermaid を 11.16.0 から 12 系へ更新するための計画と、調査で分かったことをまとめる。

このファイルの位置づけ: **これから実装する計画**。実装が進んだら各段階に実装済み印を
付け、完了後は履歴として残す（`_docs/marked-migration.md` と同じ扱い）。

作成時点の状態（2026-09-23）: 同梱 mermaid **11.16.0**、アプリバージョン **0.16.3**。
mermaid 12.0.0 はリリース済み。

段階 2 の着手時（2026-10-03）: アプリバージョン **0.16.4**。12.0.x のパッチは出ず、
次の版は **12.1.0**（2026-10-02）だった。パッチ修正もまとめて入っているため、12.1.0 を同梱する。

## 方針

- **0.17.0 で同梱版を mermaid 12 にする**。
- 着手は mermaid 12 のパッチ（12.0.x）が出てから。12.0.0 直後は様子を見る。
  Binder 側も 0.16.x のパッチが出る可能性があるため、それまでは静観する。
  → 12.0.x を経ずに 12.1.0 が出たため、12.1.0 で着手した。
- 既存の図の見た目は変えない（12 の新しい既定値は使わない）。新しい見た目は
  ユーザが図・スタイルテンプレートで明示したときだけ使われるようにする。

## 段階

| 段階 | 内容 | 状態 |
|---|---|---|
| 1 | `initialize` に 11 系の既定（theme / look / layout）を明示する | **実装済み**（0.16.x、コミット `6538b693`） |
| 2 | 同梱 `mermaid.min.js` を 12.1.0 に差し替え、12 で増えた既定値（minNodeWidth / wrappingWidth）も 11 系に戻す（0.17.0） | **実装済み**（macOS / Linux での確認は未実施） |

## mermaid 12.0.0 の破壊的変更（Binder に関係するもの）

リリースノート（https://github.com/mermaid-js/mermaid/releases ）と 12.0.0 の
`dist/mermaid.min.js` の中身を読んで確認した。

1. **ELK を同梱し、既定のレイアウトにした**（flowchart / state / class / ER / requirement / use case）。
   何も指定していない図は ELK で配置し直される。
2. **既定のテーマ `redux-color`・見た目 `neo`**（flowchart, swimlane, class, ER, requirement,
   sequence, state, use case, venn, agentflow）。トップレベルの既定は `theme:"default"` /
   `look:"classic"` のままだが、**図の種類ごとのキー**（`flowchart.theme` 等）に新しい既定が入っている。
3. **`defaultRenderer` の廃止**（flowchart / class / state）。トップレベルの `layout` に置き換わった。
4. **動作環境が ES2024 / Safari 17.4+ / Node 22.12+ になった**。
5. 公開 API から ELK 関連の内部関数（`clearLayoutRenderState` 等）が削除された。Binder では未使用。
6. 新しい図の種類: UML の use case（`usecase-beta`）、AgentFlow（`agentflow-beta`）。
7. **flowchart / state のノード最小幅 `minNodeWidth: 120` と折り返し幅 `wrappingWidth: 120` が既定になった**
   （11.16 は最小幅なし、flowchart の折り返しは 200）。look が classic のままでもノードが横に広がる。
   計画時には見落としており、段階 2 の描画確認で見つけた。

12.1.0 で追加された変更（Binder に関係するもの）:
- `elk.orientFeedbackEdges`（既定で有効）。ELK でサブグラフへ戻る辺の引き回しが変わる。
  Binder の既定は dagre なので、ELK を明示した図だけに影響する。

配布ファイル: `dist/mermaid.min.js`（UMD）と `dist/mermaid.esm.min.mjs` は 12.0.0 にもあり、
読み込み方法（`Mermaid.tryLoadUrl` の ESM → UMD の順）はそのまま使える。
`mermaid.min.js` は約 3.4MB → 約 5.3MB に増える（ELK 同梱のため）。

**ライセンス**: 12 から elkjs（**EPL-2.0**）がバンドルに入る。`THIRD_PARTY_LICENSES` に
elkjs の項（ライセンス文の所在とソースの入手先）を追加した。

## theme / look / layout の優先順位（12.0.0 の `resolveAppearance`）

theme / look / layout の 3 つは、次の順で最初に値が見つかったものが使われる。

1. 描画中に渡された設定
2. **ダイアグラム内の指定**（`%%{init:...}%%`、frontmatter の `config:`、Binder のスタイルテンプレート）
3. **`initialize()` で渡した設定**（siteConfig）
4. mermaid の既定値

それぞれの段の中では、図の種類ごとのキー（`flowchart.look`）がトップレベル（`look`）より優先される。

帰結:
- `initialize` の値はユーザの指定（2）を上書きしない。
- `initialize` で渡せば 12 の新しい既定（4）を抑えられる。トップレベルで足りる。
- **`flowchart-elk` キーワードは ELK にならない**。キーワードによる指定は 4 と同じ扱いで、
  `initialize` の `layout`（トップレベル・図の種類ごとのどちらでも）に上書きされる
  （12.1.0 で実描画して確認。`initialize` で layout を渡さなければ ELK になる）。
  11.16 の同梱版も dagre で描いていたので見た目は変わらない。ELK にしたい場合は
  `%%{init: {"layout": "elk"}}%%` や frontmatter の `config.layout` で指定する。
- **トップレベルの `layout` は 12 の `swimlane.layout: "swimlane"`（4）も上書きしてしまう**。
  そのため `swimlane: { layout: 'swimlane' }` を別に指定している。
  12 の既定で図ごとに layout を持つのは swimlane（`swimlane`）と state（`elk`）だけ。
  state は dagre に戻すのが互換の目的どおりなので個別指定しない。

## 段階 1: 実装内容

`_cmd/shared/frontend/editor/engines/Mermaid.jsx` の `DefaultOpts`:

```js
const DefaultOpts = {
  startOnLoad: false,
  theme: 'default',
  look: 'classic',
  layout: 'dagre',
  swimlane: { layout: 'swimlane' },
};
```

- 11.16 の既定値（`theme:"default"`, `look:"classic"`, `layout:"dagre"`）と同じ値なので、同梱版での描画は変わらない。
  `swimlane.layout` は 11.16 では使われないキー。
- `init()` と `loadAndValidate()` の両方がこの定数を使う。Binder 側の
  `components/editor/engines/Mermaid.jsx` は re-export なので Binder / Lite の両方に効く。
- **影響があるのは、バインダー設定の Mermaid URL に 12 系（`@12` / `@latest`）を指定しているユーザだけ**。
  12 の新しい見た目から 11 系の見た目に戻る。12 の見た目を使いたい場合は図・スタイルテンプレートで
  `%%{init: {"theme": "redux-color", "look": "neo", "layout": "elk"}}%%` のように指定する。
- 公開済みの図は保存済み SVG を使うため、開いて描き直すまで見た目は変わらない。

## 段階 2: 0.17.0 でやること

- [x] 同梱 `mermaid.min.js` を 12.1.0 に差し替える（`_cmd/binder/frontend/src/assets/vendor/` と `_cmd/lite/frontend/src/assets/vendor/`）。
  生成方法は下の「バンドル生成手順」
- [x] バージョン文字列を更新する（`_cmd/binder/frontend/src/main.jsx` の `MERMAID_VENDOR_VERSION`、`_cmd/lite/frontend/src/main.jsx` の `setVendorVersion`）
- [x] バインダー設定の入力例（`_cmd/binder/frontend/src/dialogs/Binder.jsx` の placeholder）を更新する
- [x] 補完候補の一覧と翻訳の対応表（`_cmd/shared/frontend/editor/mermaid-candidates.js`）に
  `usecase-beta` と `agentflow-beta` を追加し、言語ファイルにラベル（`autocomplete.mermaid.usecase` / `.agentflow`）を追加する。
  既存の候補は 12.1.0 でもすべて `detectType` を通ることを確認した（`zenuml` は外部プラグインのため従来から無効）
- [x] `THIRD_PARTY_LICENSES` に elkjs（EPL-2.0）を追加する
- [x] `DefaultOpts` に `flowchart` / `state` の `minNodeWidth: 0`・`wrappingWidth: 200` を追加する（破壊的変更 7）。
  通常の設定キーなので、図側で `%%{init: {"flowchart": {"minNodeWidth": 120}}}%%` のように指定すれば 12 の値になる（確認済み）
- [x] **実際に描画して確認する**（下の「描画確認の結果」）
  - 既存の図が 11.16 と同じ見た目で描かれること（flowchart / sequence / class / state / ER など）
  - swimlane 図が専用レイアウトのまま描かれること（`swimlane.layout` の個別指定が効いていること）
  - `%%{init}%%`・frontmatter・スタイルテンプレートの theme / look / layout 指定が効くこと
- [ ] `task dev` でアプリ上のプレビュー描画と公開 HTML を目視確認する
- [ ] macOS（WKWebView）・Linux（WebKitGTK）で動作を確認する。ES2024 が必要なため、
  WebKit が古い環境（未更新の macOS 12 など）では読み込めない可能性がある。
  CDN の読み込み失敗は同梱版へ戻るが、読み込めてから描画時に落ちる場合は救済されない
- [ ] リリースノートに書く（下の「リリースノートの下書き」）

## 描画確認の結果（2026-10-03、Windows の Edge ヘッドレス）

11.16.0（差し替え前の同梱版）と 12.1.0 のバンドルを同じ `DefaultOpts` で `mermaid.render` し、
SVG の viewBox・look・ノードの塗りとスクリーンショットを比べた。

| 図 | 結果 |
|---|---|
| flowchart / sequence / class / state / ER | 11.16 と viewBox・配色まで一致（minNodeWidth / wrappingWidth を戻す前は flowchart と state の幅が広がっていた） |
| 長いラベルの折り返し（flowchart） | 一致 |
| swimlane（`swimlane-beta`） | 12 の専用レイアウト（レーン）で描かれる。11.16 はサブグラフとして描いていたので見た目は変わる |
| `%%{init}%%` で theme: redux-color / look: neo / layout: elk | 指定どおり neo・ELK で描かれる（11.16 は ELK が無く dagre） |
| frontmatter（theme: forest / look: handDrawn） | 指定どおり |
| スタイルテンプレート相当（`%%{init}%%` の前置き、theme: dark） | 指定どおり、11.16 と一致 |
| `flowchart-elk` キーワード | dagre のまま（11.16 と一致）。上の「帰結」を参照 |
| `usecase-beta` / `agentflow-beta` | 描画できる |

## バンドル生成手順

npm の `dist/mermaid.min.js` をそのまま置かず、esbuild で IIFE にバンドルし直す（11.16.0 のときと同じ手順。
esbuild は 0.28.2 を使った）。作業は作業ツリーの外の一時ディレクトリで行う。

```bash
npm init -y && npm install mermaid@12.1.0 esbuild
echo 'export { default } from "mermaid";' > entry.mjs
npx esbuild entry.mjs --bundle --format=iife   --global-name=__esbuild_esm_mermaid_nm.mermaid --minify   --legal-comments=eof --banner:js='"use strict";'   --footer:js='globalThis["mermaid"] = globalThis.__esbuild_esm_mermaid_nm["mermaid"].default;'   --outfile=mermaid.min.js
```

## リリースノートの下書き

- 同梱の mermaid を 11.16.0 から 12.1.0 に更新しました。既存の図は今までと同じ見た目で描かれます
  （12 で変わった既定のテーマ・見た目・レイアウト・ノード幅は使わず、従来の値に固定しています）。
- 12 の新しい見た目は、図やスタイルテンプレートで指定すると使えます。
  例: `%%{init: {"theme": "redux-color", "look": "neo", "layout": "elk"}}%%`
- `layout: elk` を指定している図は、本当に ELK で描かれるようになります
  （これまでの同梱版は ELK を含まないため dagre で描いていました）→ 見た目が変わります。
  `flowchart-elk` と書いた図は今までどおり dagre で描かれます。ELK にしたい場合は `layout: elk` を指定してください。
- swimlane 図（`swimlane-beta`）がレーンに分かれた専用のレイアウトで描かれるようになります。
- `flowchart.defaultRenderer` の指定は無視されるようになります（描画結果は今と同じ dagre）。
- 新しい図の種類 use case（`usecase-beta`）と AgentFlow（`agentflow-beta`）が使えます。入力補完にも追加しました。
- 動作には Safari 17.4 相当以上の WebKit が必要です（macOS / Linux）。
- 配布物が約 2MB 大きくなります（ELK を同梱するため）。
