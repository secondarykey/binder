import React from "react";
import Mermaid from "./engines/Mermaid";

/**
 * HTMLプレビュー用ダブルバッファ iframe コンポーネント
 *
 * 2つの iframe を交互に使い、裏側で描画が完了してから表示を切り替えることで
 * ちらつきを防止する。
 *
 * Props:
 *   html       - 表示する HTML 文字列
 *   cursorLine - エディタのカーソル行（1始まり）。プレビューのスクロール位置に使用
 */
class HTMLFrame extends React.Component {

  constructor(props) {
    super(props);
    this.refs0 = React.createRef();
    this.refs1 = React.createRef();
    // 現在表示中の iframe インデックス (0 or 1)
    this.active = -1;
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

  getIframe(index) {
    return index === 0 ? this.refs0.current : this.refs1.current;
  }

  view() {
    const html = this.props.html;
    if (!html) return;

    // 裏側の iframe を決定
    const backIndex = this.active <= 0 ? 1 : 0;
    const backIframe = this.getIframe(backIndex);
    if (!backIframe) return;

    // 裏 iframe に描画開始
    backIframe.onload = () => {
      const doc = backIframe.contentDocument;
      this.postProcess(doc, () => {
        // 描画完了後に表裏を切り替え
        this.swap(backIndex);
      });
    };
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

  postProcess(doc, onComplete) {
    if (!doc) { onComplete?.(); return; }

    // クリックを禁止
    doc.addEventListener('click', (e) => e.preventDefault());

    // iframe 内のキーボードイベントを親ウィンドウに転送（F12 など）
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        window.document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12' }));
      }
    });

    // ソース行コメントを data-src-line 属性に変換
    this.attachSourceLines(doc);

    // ノート内の Mermaid ダイアグラムを描画
    const mermaidElements = Array.from(doc.querySelectorAll('div.binderSVG'));
    if (mermaidElements.length === 0) {
      // Mermaid なし → 即完了
      this.scrollToSourceLine(doc, this.props.cursorLine);
      onComplete?.();
      return;
    }

    // 全 Mermaid の描画完了を待ってから切り替え
    const promises = mermaidElements.map((elm) => {
      const txt = elm.textContent;
      return Mermaid.parse(txt).then((data) => {
        elm.innerHTML = data.svg;
      }).catch((err) => {
        console.error(err);
      });
    });

    Promise.all(promises).then(() => {
      this.scrollToSourceLine(doc, this.props.cursorLine);
      onComplete?.();
    });
  }

  render() {
    return (
      <>
        <iframe className="htmlViewer" ref={this.refs0} style={{ visibility: 'hidden' }} />
        <iframe className="htmlViewer" ref={this.refs1} style={{ visibility: 'hidden' }} />
      </>
    );
  }
}

export default HTMLFrame;
