import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import HTMLFrame from '@shared/editor/HTMLFrame';

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
});
