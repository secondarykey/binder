import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import HTMLFrame, { renderDiagramError, hasScripts } from '@shared/editor/HTMLFrame';

describe('HTMLFrame', () => {
  it('renders two iframes for double buffering', () => {
    const { container } = render(<HTMLFrame html="<p>test</p>" />);
    const iframes = container.querySelectorAll('iframe.htmlViewer');
    expect(iframes).toHaveLength(2);
  });

  // iframe はアプリと同じオリジンで表示するため、既定ではスクリプトを止める
  it('sandboxes both iframes by default', () => {
    const { container } = render(<HTMLFrame html="<p>test</p>" />);
    for (const iframe of container.querySelectorAll('iframe.htmlViewer')) {
      expect(iframe.getAttribute('sandbox')).toBe('allow-same-origin');
    }
  });

  it('lifts the sandbox when scripts are allowed', () => {
    const { container, rerender } = render(<HTMLFrame html="<p>test</p>" allowScripts />);
    // 最初の描画は裏側（2つ目）の iframe に読み込む
    const back = container.querySelectorAll('iframe.htmlViewer')[1];
    expect(back.hasAttribute('sandbox')).toBe(false);

    // 信頼を外したら、HTML が同じでも sandbox を付けて読み込み直す
    rerender(<HTMLFrame html="<p>test</p>" allowScripts={false} />);
    for (const iframe of container.querySelectorAll('iframe.htmlViewer')) {
      expect(iframe.getAttribute('sandbox')).toBe('allow-same-origin');
    }
  });

  it('renders with both iframes initially hidden', () => {
    const { container } = render(<HTMLFrame html="" />);
    const iframes = container.querySelectorAll('iframe.htmlViewer');
    for (const iframe of iframes) {
      expect(iframe.style.visibility).toBe('hidden');
    }
  });

  it('shows a diagram error where the diagram would be', () => {
    const elm = document.createElement('div');
    elm.className = 'binderSVG';
    elm.id = 'diagram-id';
    elm.dataset.mermaid = 'Zmxvdw==';

    renderDiagramError(elm, new Error('Parse error on line 2:\n<b>x</b>'));

    const err = elm.querySelector('.binderError');
    expect(err).not.toBeNull();
    expect(err.textContent).toBe('ERROR: drawDiagram(diagram-id): Parse error on line 2:\n<b>x</b>');
    // エラー文は HTML として解釈しない
    expect(err.querySelector('b')).toBeNull();
  });

  it('shows a diagram error that is not an Error object', () => {
    const elm = document.createElement('div');
    elm.id = 'diagram-id';

    renderDiagramError(elm, 'syntax error');

    expect(elm.textContent).toBe('ERROR: drawDiagram(diagram-id): syntax error');
  });

  it('finds scripts and inline event handlers', () => {
    const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
    expect(hasScripts(parse('<p>text</p><pre><code>&lt;script&gt;</code></pre>'))).toBe(false);
    expect(hasScripts(parse('<p>text</p><script>hljs.highlightAll()</script>'))).toBe(true);
    expect(hasScripts(parse('<img src="x.png" onerror="alert(1)">'))).toBe(true);
    expect(hasScripts(null)).toBe(false);
  });
});

// プレビューの見出しを押すと、エディタで元の行へ飛ぶための情報を渡す
describe('HTMLFrame.attachHeadingClick', () => {
  const setup = (html, onHeadingClick) => {
    const doc = new DOMParser().parseFromString(`<html><head></head><body>${html}</body></html>`, 'text/html');
    const frame = new HTMLFrame({ onHeadingClick });
    frame.attachHeadingClick(doc);
    return doc;
  };
  const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

  it('passes the heading text, its occurrence and the source line', () => {
    const calls = [];
    const doc = setup('<h2>Intro</h2><p>x</p><h2 data-src-line="9"> Intro </h2>', (t) => calls.push(t));
    click(doc.querySelectorAll('h2')[1]);
    expect(calls).toEqual([{ text: 'Intro', occurrence: 1, srcLine: 9 }]);
  });

  it('ignores links inside headings and other elements', () => {
    const calls = [];
    const doc = setup('<h2><a href="#x">link</a> text</h2><p>para</p>', (t) => calls.push(t));
    click(doc.querySelector('a'));
    click(doc.querySelector('p'));
    expect(calls).toHaveLength(0);
  });

  it('adds the pointer cursor only when the callback is given', () => {
    expect(setup('<h1>a</h1>', () => {}).querySelector('style')?.textContent).toContain('cursor: pointer');
    expect(setup('<h1>a</h1>', undefined).querySelector('style')).toBeNull();
  });
});
