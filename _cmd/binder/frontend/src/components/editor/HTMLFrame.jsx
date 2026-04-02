import React from "react";
import morphdom from "morphdom";
import Mermaid from "./engines/Mermaid";

/**
 * HTMLプレビュー用 iframe コンポーネント
 *
 * 初回のみ srcdoc でドキュメントをロードし、以降の更新は
 * contentDocument.body.innerHTML を直接差し替えることでドキュメントリロードを
 * 回避する。リロードがないため白フラッシュが発生しない。
 *
 * Props:
 *   html       - 表示する HTML 文字列
 *   cursorLine - エディタのカーソル行（1始まり）。プレビューのスクロール位置に使用
 */
class HTMLFrame extends React.Component {

  constructor(props) {
    super(props);
    this.iframeRef = React.createRef();
    this.initialized = false;
    this.view = this.view.bind(this);
  }

  componentDidMount() {
    this.view();
  }

  shouldComponentUpdate(nextProps) {
    return nextProps.html !== this.props.html || nextProps.cursorLine !== this.props.cursorLine;
  }

  componentDidUpdate() {
    this.view();
  }

  view() {
    const html = this.props.html;
    const iframe = this.iframeRef.current;
    if (!iframe) return;

    const iDoc = iframe.contentDocument;

    // 初回またはドキュメントが未初期化の場合は srcdoc でロード
    if (!this.initialized || !iDoc || !iDoc.body) {
      this.initialized = false;
      iframe.onload = () => {
        this.initialized = true;
        this.postProcess(iframe.contentDocument);
      };
      iframe.srcdoc = html;
      return;
    }

    // 2回目以降: DOM差分パッチで更新（未変更ノードを保持しちらつきを防ぐ）
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(html, 'text/html');

    // <head> は innerHTML で置換（画像なし、ちらつき影響なし）
    iDoc.head.innerHTML = newDoc.head.innerHTML;

    // <body> は morphdom で差分パッチ（画像等の未変更要素を保持）
    morphdom(iDoc.body, newDoc.body, {
      childrenOnly: false,
      onBeforeElUpdated(fromEl, toEl) {
        if (fromEl.isEqualNode(toEl)) return false;
        return true;
      },
    });

    // morphdom で挿入された <script> は実行されないため createElement で再作成する
    this.activateScripts(iDoc);

    this.postProcess(iDoc);
  }

  /**
   * innerHTML で挿入された <script> を createElement で再作成し実行させる
   */
  activateScripts(doc) {
    for (const old of Array.from(doc.querySelectorAll('script'))) {
      const script = doc.createElement('script');
      for (const attr of old.attributes) {
        script.setAttribute(attr.name, attr.value);
      }
      script.textContent = old.textContent;
      old.parentNode.replaceChild(script, old);
    }
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

  postProcess(doc) {
    if (!doc) return;

    // クリックを禁止（重複登録しない）
    if (!doc._binderClickBlocked) {
      doc._binderClickBlocked = true;
      doc.addEventListener('click', (e) => e.preventDefault());
    }

    // ノート内の Mermaid ダイアグラムを描画
    doc.querySelectorAll('div.binderSVG').forEach((elm) => {
      const txt = elm.textContent;
      Mermaid.parse(txt).then((data) => {
        elm.innerHTML = data.svg;
      }).catch((err) => {
        console.error(err);
      });
    });

    // ソース行コメントを data-src-line 属性に変換
    this.attachSourceLines(doc);

    // カーソル行の近傍要素へスクロール
    this.scrollToSourceLine(doc, this.props.cursorLine);
  }

  render() {
    return (
      <iframe className="htmlViewer" ref={this.iframeRef} />
    );
  }
}

export default HTMLFrame;
