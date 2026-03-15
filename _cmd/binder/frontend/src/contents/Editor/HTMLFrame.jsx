import React from "react";
import Mermaid from "./engines/Mermaid";

/**
 * HTMLプレビュー用 iframe コンポーネント
 *
 * 初回のみ srcdoc でドキュメントをロードし、以降の更新は
 * contentDocument.body.innerHTML を直接差し替えることでドキュメントリロードを
 * 回避する。リロードがないため白フラッシュが発生しない。
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
    return nextProps.html !== this.props.html;
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

    // 2回目以降: ドキュメントリロードなしで DOM を差し替え
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(html, 'text/html');

    // body を差し替え
    iDoc.body.innerHTML = newDoc.body.innerHTML;

    // <style> タグを同期（外観が変わった場合に対応）
    const newStyles = Array.from(newDoc.head.querySelectorAll('style'))
      .map(s => s.textContent).join('\n');
    let styleEl = iDoc.head.querySelector('#_binder_preview_styles');
    if (!styleEl) {
      styleEl = iDoc.createElement('style');
      styleEl.id = '_binder_preview_styles';
      iDoc.head.appendChild(styleEl);
    }
    styleEl.textContent = newStyles;

    this.postProcess(iDoc);
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

    // フォーカス位置へスクロール
    const f = doc.querySelector('#binder_focus_id');
    if (f) {
      f.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  }

  render() {
    return (
      <iframe className="htmlViewer" ref={this.iframeRef} />
    );
  }
}

export default HTMLFrame;
