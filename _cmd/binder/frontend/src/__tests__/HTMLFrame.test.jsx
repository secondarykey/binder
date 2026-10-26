import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import HTMLFrame, { renderDiagramError } from '@shared/editor/HTMLFrame';

describe('HTMLFrame', () => {
  it('renders two iframes for double buffering', () => {
    const { container } = render(<HTMLFrame html="<p>test</p>" />);
    const iframes = container.querySelectorAll('iframe.htmlViewer');
    expect(iframes).toHaveLength(2);
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
