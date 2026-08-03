import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attachCodeCopy, refreshCodeCopyLabels, CODE_COPY_STYLE_ID } from '@shared/editor/code-copy';

// jsdom の document をプレビュー iframe の contentDocument に見立てて検証する
function setBody(html) {
  document.body.innerHTML = html;
  return document;
}

describe('attachCodeCopy', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.getElementById(CODE_COPY_STYLE_ID)?.remove();
  });

  it('adds a copy button to each fenced code block', () => {
    const doc = setBody('<pre><code>a\n</code></pre><p>x</p><pre><code>b\n</code></pre>');
    const count = attachCodeCopy(doc, { onCopy: vi.fn() });

    expect(count).toBe(2);
    expect(doc.querySelectorAll('.binderCopyButton')).toHaveLength(2);
    // <pre> はラッパーに包まれる（横スクロールにボタンが追従しないようにするため）
    expect(doc.querySelectorAll('.binderCodeBlock > pre')).toHaveLength(2);
    expect(doc.getElementById(CODE_COPY_STYLE_ID)).not.toBeNull();
  });

  it('copies the code text without the trailing newline', () => {
    const onCopy = vi.fn();
    const doc = setBody('<pre><code>const a = 1;\nconst b = 2;\n</code></pre>');
    attachCodeCopy(doc, { onCopy });

    doc.querySelector('.binderCopyButton').click();

    expect(onCopy).toHaveBeenCalledWith('const a = 1;\nconst b = 2;');
  });

  it('shows the copied label after a click', () => {
    const doc = setBody('<pre><code>a\n</code></pre>');
    attachCodeCopy(doc, { onCopy: vi.fn(), copyLabel: 'コピー', copiedLabel: 'コピーしました' });

    const btn = doc.querySelector('.binderCopyButton');
    expect(btn.textContent).toBe('コピー');

    btn.click();
    expect(btn.textContent).toBe('コピーしました');
    expect(btn.classList.contains('copied')).toBe(true);
  });

  it('keeps the label when onCopy throws', () => {
    const doc = setBody('<pre><code>a\n</code></pre>');
    attachCodeCopy(doc, {
      onCopy: () => { throw new Error('failed'); },
      copyLabel: 'Copy',
      copiedLabel: 'Copied',
    });

    const btn = doc.querySelector('.binderCopyButton');
    btn.click();
    expect(btn.textContent).toBe('Copy');
  });

  it('does nothing without onCopy', () => {
    const doc = setBody('<pre><code>a\n</code></pre>');
    expect(attachCodeCopy(doc, {})).toBe(0);
    expect(doc.querySelector('.binderCopyButton')).toBeNull();
  });

  it('ignores a pre without code (mermaid parse error output)', () => {
    const doc = setBody('<pre style="color:#e57373">parse error</pre>');
    expect(attachCodeCopy(doc, { onCopy: vi.fn() })).toBe(0);
  });

  it('attaches to an element carrying data-copy-text (rendered mermaid)', () => {
    const onCopy = vi.fn();
    const doc = setBody('<div class="binderMermaid" data-copy-text="graph TD;"><svg></svg></div>');
    const count = attachCodeCopy(doc, { onCopy });

    expect(count).toBe(1);
    const host = doc.querySelector('.binderMermaid');
    expect(host.classList.contains('binderCopyHost')).toBe(true);

    host.querySelector('.binderCopyButton').click();
    expect(onCopy).toHaveBeenCalledWith('graph TD;');
  });

  it('does not attach twice to the same data-copy-text element', () => {
    const doc = setBody('<div data-copy-text="a"><svg></svg></div>');
    attachCodeCopy(doc, { onCopy: vi.fn() });
    expect(attachCodeCopy(doc, { onCopy: vi.fn() })).toBe(0);
    expect(doc.querySelectorAll('.binderCopyButton')).toHaveLength(1);
  });

  it('does not attach twice to the same block', () => {
    const doc = setBody('<pre><code>a\n</code></pre>');
    attachCodeCopy(doc, { onCopy: vi.fn() });
    expect(attachCodeCopy(doc, { onCopy: vi.fn() })).toBe(0);
    expect(doc.querySelectorAll('.binderCopyButton')).toHaveLength(1);
  });
});

describe('refreshCodeCopyLabels', () => {
  it('replaces the label of attached buttons', () => {
    const doc = setBody('<pre><code>a\n</code></pre>');
    attachCodeCopy(doc, { onCopy: vi.fn(), copyLabel: 'Copy', copiedLabel: 'Copied' });

    refreshCodeCopyLabels(doc, 'コピー', 'コピーしました');

    const btn = doc.querySelector('.binderCopyButton');
    expect(btn.textContent).toBe('コピー');

    btn.click();
    expect(btn.textContent).toBe('コピーしました');
  });
});
