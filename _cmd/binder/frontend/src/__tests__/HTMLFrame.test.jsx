import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import HTMLFrame, { renderDiagramError } from '@shared/editor/HTMLFrame';

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
});
