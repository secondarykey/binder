import React from "react";
import Mermaid from "./engines/Mermaid";
import { attachCodeCopy, applyCodeCopyStyle, refreshCodeCopyLabels } from "./code-copy";
import { renderInlineMermaid } from "./inline-mermaid";
import { attachPanZoom } from "./pan-zoom";
import { attachLinkHandler, applyLinkPolicy } from "./link-handler";
import { markUnresolvedResources } from "./preview-unresolved";
import { normalizeHeadingText } from "./outline";
import { isRelativeImageSrc } from "./image-paste";

/**
 * 図（div.binderSVG）の描画に失敗したとき、図の場所にエラーを表示する。
 * 何も出さないと空白になり、図に間違いがあることに気づけない。
 * 見え方は Go 側のテンプレート関数のエラー（templateError）に揃える。
 * Mermaid のエラーは行と位置を示す複数行の文なので、改行を残して表示する。
 */
export function renderDiagramError(elm, err) {
  const msg = err?.message ?? String(err);
  const div = elm.ownerDocument.createElement('div');
  div.className = 'binderError';
  div.style.color = 'red';
  div.style.whiteSpace = 'pre-wrap';
  div.textContent = `ERROR: drawDiagram(${elm.id}): ${msg}`;
  elm.replaceChildren(div);
}

/**
 * HTML にスクリプト（<script> 要素か、onclick などの on… 属性）があるかを返す。
 * sandbox で止めたことを知らせるかどうかの判定に使う。
 */
export function hasScripts(doc) {
  if (!doc?.querySelector) return false;
  if (doc.querySelector('script')) return true;
  for (const el of doc.querySelectorAll('*')) {
    for (const attr of el.attributes) {
      if (/^on/i.test(attr.name)) return true;
    }
  }
  return false;
}

/**
 * HTMLプレビュー用ダブルバッファ iframe コンポーネント
 *
 * 2つの iframe を交互に使い、裏側で描画が完了してから表示を切り替えることで
 * ちらつきを防止する。
 *
 * Props:
 *   html            - 表示する HTML 文字列
 *   cursorLine      - エディタのカーソル行（1始まり）。プレビューのスクロール位置に使用
 *   colorSchemeAttr - カラースキーム属性名（例: "data-theme"）
 *   colorSchemeValue - カラースキーム値（例: "dark"）
 *   customScrollbar - true で iframe 内のスクロールバーをアプリ側と同じ見た目にする
 *   onCopyCode      - 指定するとコードブロックにコピーボタンを表示し、押下時に本文を渡して呼ぶ
 *   copyLabels      - コピーボタンのラベル { copy, copied }（参照が変わると付与済みボタンに反映）
 *   inlineMermaid   - true で ```mermaid のコードブロックを図として描画する
 *   panZoomHint     - 図（div.binderSVG）に付ける操作説明（title 属性）
 *   inlinePanZoomHint - 文章中の図（```mermaid 由来）に付ける操作説明
 *   panZoomLabels   - 指定すると図の左上に操作ボタンを置く { zoomIn, zoomOut, reset, pan }
 *   onLinkExternal  - 外部リンク（http/https 等）を押した時に URL を渡して呼ぶ
 *   onLinkInternal  - バインダー内リンク（/pages/x.html 等）を押した時に href を渡して呼ぶ
 *   onHeadingClick  - 指定すると見出し（h1〜h6）を押した時に { text, occurrence, srcLine } を渡して呼ぶ。
 *                     occurrence は同じ文字の見出しのうち何番目か（0始まり）、srcLine は data-src-line
 *   onBlockDoubleClick - 指定すると見出し以外のブロックをダブルクリックした時に、その data-src-line（行）を渡して呼ぶ
 *   resolveImage    - 指定すると相対パスの <img> の src を渡して呼ぶ。Promise で data URI を返すと差し替える
 *                     （srcdoc では相対パスを読めないため。Lite がファイルの隣の画像を出すのに使う）
 *   onContextMenu   - 指定すると WebView 既定のコンテキストメニューを止め、
 *                     { x, y, kind, href, selection } を渡して呼ぶ（座標は親ウィンドウ基準）
 *   unresolvedLabel - プレビューで解決できない画像参照に出す説明。
 *                     指定するとその画像を見えるプレースホルダに置き換える
 *   unresolvedHints - パスから種別を導けた場合に併記する代替の書き方
 *                     { diagram, layer, asset }。関数名はアプリ依存なので文言を渡す
 *   allowScripts    - true で HTML 中のスクリプトを動かす。既定は止める
 *   onScriptsBlocked - 表示を切り替えるたびに、スクリプトを止めたかどうかを渡して呼ぶ。
 *                     止めていても HTML にスクリプトが無ければ false
 *
 * iframe はアプリと同じオリジンで HTML を表示するため、スクリプトを動かすと
 * アプリの機能（Wails のランタイム）を呼べてしまう。既定では sandbox で止め、
 * 信頼したバインダーだけ allowScripts で動かす。sandbox="allow-same-origin" なら
 * 中のスクリプトは動かず、外側からの描画・クリックやホイールの処理は今までどおり動く。
 *
 * リンクの扱いは link-handler.js を参照。未指定のコールバックに対応するリンクは
 * 何も起こらない（プレビューが遷移することはない）。
 */

// iframe に注入するスクロールバー用 <style> のID
const SCROLLBAR_STYLE_ID = 'binder-scrollbar-style';

// スクリプトを止めるときの sandbox。外側から中を描画・操作するため allow-same-origin は付ける
const NO_SCRIPT_SANDBOX = 'allow-same-origin';

class HTMLFrame extends React.Component {

  constructor(props) {
    super(props);
    this.refs0 = React.createRef();
    this.refs1 = React.createRef();
    // 現在表示中の iframe インデックス (0 or 1)
    this.active = -1;
    this.view = this.view.bind(this);
    this.themeObserver = null;
  }

  componentDidMount() {
    this.view();
    // アプリのテーマ切り替え（data-theme の変化）に追従してスクロールバー色を更新する
    if (typeof MutationObserver !== 'undefined') {
      this.themeObserver = new MutationObserver(() => {
        const doc = this.getIframe(this.active)?.contentDocument;
        if (!doc) return;
        this.applyScrollbarStyle(doc);
        // コピーボタンの色もテーマ変数から実値で注入しているため追従させる
        if (doc.querySelector('.binderCopyButton')) applyCodeCopyStyle(doc);
      });
      this.themeObserver.observe(window.document.documentElement, {
        attributes: true, attributeFilter: ['data-theme'],
      });
    }
  }

  componentWillUnmount() {
    this.themeObserver?.disconnect();
    this.themeObserver = null;
  }

  shouldComponentUpdate(nextProps) {
    return nextProps.html !== this.props.html
      || nextProps.cursorLine !== this.props.cursorLine
      || nextProps.colorSchemeAttr !== this.props.colorSchemeAttr
      || nextProps.colorSchemeValue !== this.props.colorSchemeValue
      || nextProps.customScrollbar !== this.props.customScrollbar
      || nextProps.copyLabels !== this.props.copyLabels
      || nextProps.inlineMermaid !== this.props.inlineMermaid
      || nextProps.allowScripts !== this.props.allowScripts;
  }

  componentDidUpdate(prevProps) {
    if (prevProps.copyLabels !== this.props.copyLabels) {
      // 言語切り替え時。HTMLが同じなら iframe は作り直されないのでラベルだけ差し替える
      const doc = this.getIframe(this.active)?.contentDocument;
      const labels = this.props.copyLabels || {};
      if (doc) refreshCodeCopyLabels(doc, labels.copy, labels.copied);
    }
    if (prevProps.customScrollbar !== this.props.customScrollbar) {
      // 設定の切り替えは再描画せず表示中の iframe に即反映する
      const activeIframe = this.getIframe(this.active);
      if (activeIframe?.contentDocument) {
        this.applyScrollbarStyle(activeIframe.contentDocument);
      }
    }
    if (prevProps.html !== this.props.html || prevProps.allowScripts !== this.props.allowScripts) {
      // sandbox の変更は次の読み込みから効くため、HTML が同じでも読み込み直す
      this.view();
    } else if (prevProps.cursorLine !== this.props.cursorLine) {
      // HTML未変更でカーソル行のみ変化 → 表示中のiframeでスクロールだけ実行
      const activeIframe = this.getIframe(this.active);
      if (activeIframe?.contentDocument) {
        this.scrollToSourceLine(activeIframe.contentDocument, this.props.cursorLine);
      }
    } else {
      // HTML未変更でもカラースキームが変わった場合は両方のiframeに属性を反映
      const activeIframe = this.getIframe(this.active);
      if (activeIframe?.contentDocument) {
        this.applyColorScheme(activeIframe.contentDocument);
      }
    }
  }

  /**
   * iframe 内のクライアント座標を親ウィンドウ基準に直してから通知する。
   */
  raiseContextMenu(doc, info) {
    const rect = doc.defaultView?.frameElement?.getBoundingClientRect?.();
    this.props.onContextMenu?.({
      ...info,
      x: info.x + (rect?.left ?? 0),
      y: info.y + (rect?.top ?? 0),
    });
  }

  getIframe(index) {
    return index === 0 ? this.refs0.current : this.refs1.current;
  }

  view() {
    const html = this.props.html;
    if (html == null) return;

    // 裏側の iframe を決定
    const backIndex = this.active <= 0 ? 1 : 0;
    const backIframe = this.getIframe(backIndex);
    if (!backIframe) return;

    // 裏 iframe に描画開始
    backIframe.onload = () => {
      const doc = backIframe.contentDocument;
      // 外側で手を加える前の、読み込んだままの HTML で判定する
      const blocked = !this.props.allowScripts && hasScripts(doc);
      this.postProcess(doc, () => {
        // 描画完了後に表裏を切り替え
        this.swap(backIndex);
        this.props.onScriptsBlocked?.(blocked);
      });
    };
    // sandbox は読み込みのたびに合わせる（変更は次の読み込みから効く）
    if (this.props.allowScripts) {
      backIframe.removeAttribute('sandbox');
    } else {
      backIframe.setAttribute('sandbox', NO_SCRIPT_SANDBOX);
    }
    backIframe.srcdoc = html;
  }

  /**
   * 表裏を切り替える
   */
  swap(newActiveIndex) {
    const showIframe = this.getIframe(newActiveIndex);
    const hideIframe = this.getIframe(newActiveIndex === 0 ? 1 : 0);

    if (showIframe) showIframe.style.visibility = 'visible';
    if (hideIframe) hideIframe.style.visibility = 'hidden';

    this.active = newActiveIndex;
  }

  /**
   * <!-- binder-line:N --> コメントを走査し、次の要素に
   * data-src-line="N" 属性を付与してコメントを除去する
   */
  attachSourceLines(doc) {
    if (!doc?.body) return;

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
    const toRemove = [];
    let node;

    while ((node = walker.nextNode())) {
      const m = node.nodeValue?.trim().match(/^binder-line:(\d+)$/);
      if (m) {
        const line = parseInt(m[1], 10);
        const el = node.nextElementSibling;
        if (el) el.setAttribute('data-src-line', line);
        toRemove.push(node);
      }
    }

    for (const n of toRemove) n.parentNode?.removeChild(n);
  }

  /**
   * 見出し（h1〜h6）を押したら onHeadingClick を呼ぶ。
   * リスナは常に付け、呼ぶかどうかは押した時点の props で決める。
   * 指針（cursor: pointer）は読み込んだ時点で onHeadingClick があるときだけ付ける。
   */
  attachHeadingClick(doc) {
    if (!doc?.body) return;
    const selector = 'h1, h2, h3, h4, h5, h6';

    if (this.props.onHeadingClick) {
      const style = doc.createElement('style');
      style.textContent = `${selector} { cursor: pointer; }`;
      (doc.head || doc.documentElement).appendChild(style);
    }

    doc.addEventListener('click', (e) => {
      const fn = this.props.onHeadingClick;
      if (!fn || e.button !== 0) return;
      const heading = e.target.closest?.(selector);
      if (!heading || e.target.closest('a, button')) return;
      // 文字を選んでいるとき（コピーしようとしているとき）は飛ばない
      const sel = doc.getSelection?.();
      if (sel && !sel.isCollapsed) return;

      const text = normalizeHeadingText(heading.textContent);
      let occurrence = 0;
      for (const el of doc.querySelectorAll(selector)) {
        if (el === heading) break;
        if (normalizeHeadingText(el.textContent) === text) occurrence++;
      }
      const line = heading.getAttribute('data-src-line');
      fn({ text, occurrence, srcLine: line ? parseInt(line, 10) : null });
    });
  }

  /**
   * 見出し以外のブロックをダブルクリックしたら onBlockDoubleClick を呼ぶ。
   * 行は data-src-line を使う（付いているのは外側のブロックだけなので、リストや表は先頭の行になる）。
   * リンク・ボタン・入力欄・図はダブルクリックを別の操作に使うことがあるため除く。
   * 見出しは 1 回のクリックで飛ぶ（attachHeadingClick）ので除く。
   */
  attachBlockDoubleClick(doc) {
    if (!doc?.body) return;
    doc.addEventListener('dblclick', (e) => {
      const fn = this.props.onBlockDoubleClick;
      if (!fn) return;
      const t = e.target;
      if (!t?.closest) return;
      if (t.closest('a, button, input, select, textarea, label, summary, svg, .binderSVG, .binderMermaid, h1, h2, h3, h4, h5, h6')) return;
      const block = t.closest('[data-src-line]');
      if (!block) return;
      const line = parseInt(block.getAttribute('data-src-line'), 10);
      if (!line) return;
      // ダブルクリックで選ばれた単語を外す
      doc.getSelection?.()?.removeAllRanges();
      fn(line);
    });
  }

  /**
   * カーソル行に最も近い（直前の）ブロック要素をプレビュー中央にスクロールする
   */
  scrollToSourceLine(doc, cursorLine) {
    if (!doc?.body || cursorLine == null) return;

    const elements = doc.querySelectorAll('[data-src-line]');
    if (elements.length === 0) return;

    let target = elements[0];
    let bestLine = -1;

    for (const el of elements) {
      const srcLine = parseInt(el.getAttribute('data-src-line'), 10);
      if (srcLine <= cursorLine && srcLine > bestLine) {
        bestLine = srcLine;
        target = el;
      }
    }

    target.scrollIntoView({ behavior: 'instant', block: 'center' });
  }

  applyColorScheme(doc) {
    if (!doc?.documentElement) return;
    const { colorSchemeAttr, colorSchemeValue } = this.props;
    if (colorSchemeAttr && colorSchemeValue) {
      let value = colorSchemeValue;
      if (value === 'default') {
        value = window.document.documentElement.dataset.theme || 'dark';
      }
      doc.documentElement.setAttribute(colorSchemeAttr, value);
    }
  }

  /**
   * iframe 内のスクロールバーをアプリ側（エディタ画面）と同じ見た目にする。
   * iframe にはテーマCSSが読み込まれないため、親ドキュメントで解決済みの
   * CSS変数の値を取り出して実値として注入する。
   * customScrollbar が false の場合は注入済みのスタイルを取り除く。
   */
  applyScrollbarStyle(doc) {
    const head = doc?.head || doc?.documentElement;
    if (!head) return;

    const exist = doc.getElementById?.(SCROLLBAR_STYLE_ID);
    if (!this.props.customScrollbar) {
      exist?.remove();
      return;
    }

    const cs = window.getComputedStyle(window.document.documentElement);
    const track = cs.getPropertyValue('--scrollbar-track').trim();
    const thumb = cs.getPropertyValue('--scrollbar-thumb').trim();
    const hover = cs.getPropertyValue('--scrollbar-hover').trim();
    // テーマ未適用などで値が取れない場合は既定のスクロールバーのままにする
    if (!track && !thumb && !hover) {
      exist?.remove();
      return;
    }

    const css = [
      '::-webkit-scrollbar { cursor: auto; width: 14px; }',
      `::-webkit-scrollbar-track { background: ${track}; }`,
      `::-webkit-scrollbar-thumb { cursor: auto; background: ${thumb}; }`,
      `::-webkit-scrollbar-thumb:hover { background: ${hover}; }`,
    ].join('\n');

    const style = exist || doc.createElement('style');
    style.id = SCROLLBAR_STYLE_ID;
    style.textContent = css;
    if (!exist) head.appendChild(style);
  }


  postProcess(doc, onComplete) {
    if (!doc) { onComplete?.(); return; }

    this.applyColorScheme(doc);
    this.applyScrollbarStyle(doc);

    // リンク操作（ページ内アンカー / 外部リンク / バインダー内リンク）の委譲リスナを登録する。
    // リンク以外のクリックはここで止まるため、プレビューは閲覧専用のまま保たれる。
    // コールバックは登録時ではなくクリック時の props を見る（差し替えに追従させるため）
    attachLinkHandler(doc, {
      onExternal: (url) => this.props.onLinkExternal?.(url),
      onInternal: (href) => this.props.onLinkInternal?.(href),
      // 既定のメニューを止めるかはアプリ側の指定次第なので、登録の有無を props で決める
      onContextMenu: this.props.onContextMenu
        ? (info) => this.raiseContextMenu(doc, info)
        : undefined,
    });

    // iframe 内のキーボードイベントを親ウィンドウに転送（F12 など）
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        window.document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12' }));
      }
    });

    // ソース行コメントを data-src-line 属性に変換
    this.attachSourceLines(doc);
    this.attachHeadingClick(doc);
    this.attachBlockDoubleClick(doc);

    // 描画完了後の共通処理
    const finish = () => {
      // コピーボタンは Mermaid 化されずに残ったコードブロックにだけ付ける
      const labels = this.props.copyLabels || {};
      attachCodeCopy(doc, {
        onCopy: this.props.onCopyCode,
        copyLabel: labels.copy,
        copiedLabel: labels.copied,
      });
      // リンクの書き換えは Mermaid 描画後に行う（図の中のリンクも対象にするため）
      applyLinkPolicy(doc);
      // 壊れた画像アイコンで終わらせず、解決できないことを明示する
      if (this.props.unresolvedLabel) {
        markUnresolvedResources(doc, this.props.unresolvedLabel, this.props.unresolvedHints);
      }
      this.scrollToSourceLine(doc, this.props.cursorLine);
      onComplete?.();
    };

    const tasks = [];

    // 相対パスの画像を読み込める形（data URI）に差し替える。解決できないものは finish で
    // 「解決できない」表示になる
    if (this.props.resolveImage) {
      for (const img of Array.from(doc.querySelectorAll('img[src]'))) {
        const src = img.getAttribute('src');
        if (!isRelativeImageSrc(src)) continue;
        let decoded = src;
        try { decoded = decodeURI(src); } catch { /* そのまま使う */ }
        tasks.push(Promise.resolve(this.props.resolveImage(decoded)).then((uri) => {
          if (uri) {
            img.setAttribute('data-binder-src', src);
            img.setAttribute('src', uri);
          }
        }).catch(() => {}));
      }
    }

    // ```mermaid のコードブロックを図として描画する（inlineMermaid を指定したアプリのみ）
    if (this.props.inlineMermaid) {
      tasks.push(
        renderInlineMermaid(doc, {
          panZoomHint: this.props.inlinePanZoomHint,
          panZoomLabels: this.props.panZoomLabels,
        }).catch((err) => console.error(err))
      );
    }

    // ノート内の Mermaid ダイアグラムを描画
    const mermaidElements = Array.from(doc.querySelectorAll('div.binderSVG'));
    for (const elm of mermaidElements) {
      // 既にSVGが入っている場合（lite の mermaid モード）はパースをスキップし、ズーム/パンのみ適用。
      // ペイン全体が1つの図なので、ホイールは修飾キー無しで拡大に使う
      if (elm.querySelector('svg')) {
        attachPanZoom(elm, {
          hint: this.props.panZoomHint,
          controls: !!this.props.panZoomLabels,
          labels: this.props.panZoomLabels,
        });
        continue;
      }
      const raw = elm.dataset.mermaid;
      const txt = raw
        ? new TextDecoder().decode(Uint8Array.from(atob(raw), c => c.charCodeAt(0)))
        : elm.textContent;
      tasks.push(Mermaid.parse(txt).then((data) => {
        elm.innerHTML = data.svg;
      }).catch((err) => {
        console.error(err);
        renderDiagramError(elm, err);
      }));
    }

    if (tasks.length === 0) {
      // 待つものが無い → 即完了
      finish();
      return;
    }

    // 全 Mermaid の描画完了を待ってから切り替え
    Promise.all(tasks).then(finish);
  }

  render() {
    return (
      <>
        <iframe className="htmlViewer" ref={this.refs0} sandbox={NO_SCRIPT_SANDBOX} style={{ visibility: 'hidden' }} />
        <iframe className="htmlViewer" ref={this.refs1} sandbox={NO_SCRIPT_SANDBOX} style={{ visibility: 'hidden' }} />
      </>
    );
  }
}

export default HTMLFrame;
