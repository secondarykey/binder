# mermaid 12 移行計画

同梱 mermaid を 11.16.0 から 12 系へ更新するための計画と、調査で分かったことをまとめる。

このファイルの位置づけ: **これから実装する計画**。実装が進んだら各段階に実装済み印を
付け、完了後は履歴として残す（`_docs/marked-migration.md` と同じ扱い）。

作成時点の状態（2026-09-23）: 同梱 mermaid **11.16.0**、アプリバージョン **0.16.3**。
mermaid 12.0.0 はリリース済み。

## 方針

- **0.17.0 で同梱版を mermaid 12 にする**。
- 着手は mermaid 12 のパッチ（12.0.x）が出てから。12.0.0 直後は様子を見る。
  Binder 側も 0.16.x のパッチが出る可能性があるため、それまでは静観する。
- 既存の図の見た目は変えない（12 の新しい既定値は使わない）。新しい見た目は
  ユーザが図・スタイルテンプレートで明示したときだけ使われるようにする。

## 段階

| 段階 | 内容 | 状態 |
|---|---|---|
| 1 | `initialize` に 11 系の既定（theme / look / layout）を明示する | **実装済み**（0.16.x、コミット `6538b693`） |
| 2 | 同梱 `mermaid.min.js` を 12.0.x に差し替える（0.17.0） | 未着手 |

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
6. 新しい図の種類: UML の use case、AgentFlow（beta）。

配布ファイル: `dist/mermaid.min.js`（UMD）と `dist/mermaid.esm.min.mjs` は 12.0.0 にもあり、
読み込み方法（`Mermaid.tryLoadUrl` の ESM → UMD の順）はそのまま使える。
`mermaid.min.js` は約 3.4MB → 約 5.3MB に増える（ELK 同梱のため）。

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

- [ ] 同梱 `mermaid.min.js` を差し替える（`_cmd/binder/frontend/src/assets/vendor/` と `_cmd/lite/frontend/src/assets/vendor/`）
- [ ] バージョン文字列を更新する（`_cmd/binder/frontend/src/main.jsx` の `MERMAID_VENDOR_VERSION`、`_cmd/lite/frontend/src/main.jsx` の `setVendorVersion`）
- [ ] バインダー設定の入力例（`_cmd/binder/frontend/src/dialogs/Binder.jsx` の placeholder）を更新する
- [ ] 補完候補の一覧と翻訳の対応表（`_cmd/shared/frontend/editor/mermaid-candidates.js`）に use case と AgentFlow を追加し、言語ファイルにラベルを追加する
- [ ] **実際に描画して確認する**（段階 1 の効果はコードを読んだ段階での判断で、実描画では未確認）
  - 既存の図が 11.16 と同じ見た目で描かれること（flowchart / sequence / class / state / ER など）
  - swimlane 図が専用レイアウトのまま描かれること（`swimlane.layout` の個別指定が効いていること）
  - `%%{init}%%`・frontmatter・スタイルテンプレートの theme / look / layout 指定が効くこと
- [ ] macOS（WKWebView）・Linux（WebKitGTK）で動作を確認する。ES2024 が必要なため、
  WebKit が古い環境（未更新の macOS 12 など）では読み込めない可能性がある。
  CDN の読み込み失敗は同梱版へ戻るが、読み込めてから描画時に落ちる場合は救済されない
- [ ] リリースノートに書く
  - `layout: elk` / `flowchart-elk` を指定している図は、本当に ELK で描かれるようになる
    （11.16 の同梱版は ELK を含まないため dagre で描かれていた）→ 見た目が変わる
  - `flowchart.defaultRenderer: elk` は無視されるようになる（描画結果は今と同じ dagre）
  - 動作環境が Safari 17.4 相当以上の WebKit になる
  - バイナリが約 2MB 大きくなる
