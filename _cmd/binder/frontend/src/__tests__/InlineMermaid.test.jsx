import { describe, it, expect, vi, beforeEach } from 'vitest';
import Mermaid from '@shared/editor/engines/Mermaid';
import { renderInlineMermaid, INLINE_MERMAID_STYLE_ID } from '@shared/editor/inline-mermaid';

// jsdom の document をプレビュー iframe の contentDocument に見立てて検証する
function setBody(html) {
  document.body.innerHTML = html;
  return document;
}

describe('renderInlineMermaid', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.getElementById(INLINE_MERMAID_STYLE_ID)?.remove();
    vi.restoreAllMocks();
  });

  it('replaces a ```mermaid code block with the rendered svg', async () => {
    vi.spyOn(Mermaid, 'parse').mockResolvedValue({ svg: '<svg id="d1"></svg>' });

    const doc = setBody('<pre><code class="language-mermaid">graph TD;\nA--&gt;B;\n</code></pre>');
    const count = await renderInlineMermaid(doc);

    expect(count).toBe(1);
    expect(Mermaid.parse).toHaveBeenCalledWith('graph TD;\nA-->B;\n');
    expect(doc.querySelector('pre')).toBeNull();
    expect(doc.querySelector('.binderMermaid svg')).not.toBeNull();
    expect(doc.getElementById(INLINE_MERMAID_STYLE_ID)).not.toBeNull();
  });

  it('keeps the source in data-copy-text so it can still be copied', async () => {
    vi.spyOn(Mermaid, 'parse').mockResolvedValue({ svg: '<svg></svg>' });

    const doc = setBody('<pre><code class="language-mermaid">graph TD;\nA--&gt;B;\n</code></pre>');
    await renderInlineMermaid(doc);

    expect(doc.querySelector('.binderMermaid').dataset.copyText).toBe('graph TD;\nA-->B;');
  });

  it('carries over data-src-line for preview scroll sync', async () => {
    vi.spyOn(Mermaid, 'parse').mockResolvedValue({ svg: '<svg></svg>' });

    const doc = setBody('<pre data-src-line="12"><code class="language-mermaid">graph TD;</code></pre>');
    await renderInlineMermaid(doc);

    expect(doc.querySelector('.binderMermaid').getAttribute('data-src-line')).toBe('12');
  });

  it('keeps the code block when mermaid fails to parse', async () => {
    vi.spyOn(Mermaid, 'parse').mockRejectedValue(new Error('syntax error'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const doc = setBody('<pre><code class="language-mermaid">grph TD;</code></pre>');
    const count = await renderInlineMermaid(doc);

    expect(count).toBe(0);
    expect(doc.querySelector('pre > code.language-mermaid')).not.toBeNull();
  });

  it('leaves other languages untouched', async () => {
    const parse = vi.spyOn(Mermaid, 'parse');

    const doc = setBody('<pre><code class="language-js">const a = 1;</code></pre><pre><code>plain</code></pre>');
    const count = await renderInlineMermaid(doc);

    expect(count).toBe(0);
    expect(parse).not.toHaveBeenCalled();
    expect(doc.querySelectorAll('pre')).toHaveLength(2);
  });

  it('renders every mermaid block in the document', async () => {
    vi.spyOn(Mermaid, 'parse').mockResolvedValue({ svg: '<svg></svg>' });

    const doc = setBody(
      '<pre><code class="language-mermaid">a</code></pre>'
      + '<p>text</p>'
      + '<pre><code class="mermaid">b</code></pre>'
    );
    const count = await renderInlineMermaid(doc);

    expect(count).toBe(2);
    expect(doc.querySelectorAll('.binderMermaid')).toHaveLength(2);
  });
});
