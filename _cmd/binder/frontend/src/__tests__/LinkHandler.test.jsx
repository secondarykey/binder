import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyLink, applyLinkPolicy, attachLinkHandler } from '@shared/editor/link-handler';

// jsdom の document をプレビュー iframe の contentDocument に見立てて検証する
function setBody(html) {
  document.body.innerHTML = html;
  return document;
}

describe('classifyLink', () => {
  it('classifies in-page anchors', () => {
    expect(classifyLink('#heading')).toBe('anchor');
    expect(classifyLink('#fn-1')).toBe('anchor');
  });

  it('classifies external links', () => {
    expect(classifyLink('https://example.com/')).toBe('external');
    expect(classifyLink('http://example.com/')).toBe('external');
    expect(classifyLink('mailto:a@example.com')).toBe('external');
    // スキーム相対URL
    expect(classifyLink('//example.com/')).toBe('external');
  });

  it('classifies binder paths as internal', () => {
    expect(classifyLink('/pages/foo.html')).toBe('internal');
    expect(classifyLink('bar.html')).toBe('internal');
    expect(classifyLink('/assets/img.png')).toBe('internal');
  });

  it('blocks script schemes and empty hrefs', () => {
    expect(classifyLink('javascript:alert(1)')).toBe('blocked');
    expect(classifyLink('data:text/html,x')).toBe('blocked');
    expect(classifyLink('')).toBe('blocked');
  });
});

describe('applyLinkPolicy', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('moves href to data-href so the native context menu has no link items', () => {
    const doc = setBody('<a href="https://example.com/">ext</a><a href="/pages/a.html">int</a><a href="#h">anchor</a>');
    applyLinkPolicy(doc);

    for (const a of doc.querySelectorAll('a')) {
      expect(a.hasAttribute('href')).toBe(false);
    }
    const [ext, int, anchor] = doc.querySelectorAll('a');
    expect(ext.dataset.linkKind).toBe('external');
    expect(ext.dataset.href).toBe('https://example.com/');
    expect(int.dataset.linkKind).toBe('internal');
    expect(int.dataset.href).toBe('/pages/a.html');
    expect(anchor.dataset.linkKind).toBe('anchor');
    expect(anchor.dataset.href).toBe('#h');
  });

  it('keeps the destination of an external link visible in the title', () => {
    const doc = setBody('<a href="https://example.com/x">ext</a>');
    applyLinkPolicy(doc);
    expect(doc.querySelector('a').getAttribute('title')).toBe('https://example.com/x');
  });

  it('drops the destination of a blocked link', () => {
    const doc = setBody('<a href="javascript:alert(1)">x</a>');
    applyLinkPolicy(doc);
    const a = doc.querySelector('a');
    expect(a.dataset.linkKind).toBe('blocked');
    expect(a.dataset.href).toBeUndefined();
    expect(a.hasAttribute('href')).toBe(false);
  });

  it('removes target so the link cannot open another window', () => {
    const doc = setBody('<a href="https://example.com/" target="_blank">x</a>');
    applyLinkPolicy(doc);
    expect(doc.querySelector('a').hasAttribute('target')).toBe(false);
  });
});

describe('attachLinkHandler', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('sends external links to onExternal', () => {
    const onExternal = vi.fn();
    const onInternal = vi.fn();
    const doc = setBody('<a href="https://example.com/">ext</a>');
    applyLinkPolicy(doc);
    attachLinkHandler(doc, { onExternal, onInternal });

    doc.querySelector('a').click();

    expect(onExternal).toHaveBeenCalledWith('https://example.com/');
    expect(onInternal).not.toHaveBeenCalled();
  });

  it('sends binder links to onInternal', () => {
    const onExternal = vi.fn();
    const onInternal = vi.fn();
    const doc = setBody('<a href="/pages/a.html">int</a>');
    applyLinkPolicy(doc);
    attachLinkHandler(doc, { onExternal, onInternal });

    doc.querySelector('a').click();

    expect(onInternal).toHaveBeenCalledWith('/pages/a.html');
    expect(onExternal).not.toHaveBeenCalled();
  });

  it('resolves a click on an element inside the link', () => {
    const onExternal = vi.fn();
    const doc = setBody('<a href="https://example.com/"><code>ext</code></a>');
    applyLinkPolicy(doc);
    attachLinkHandler(doc, { onExternal });

    doc.querySelector('code').click();

    expect(onExternal).toHaveBeenCalledWith('https://example.com/');
  });

  it('scrolls to the anchor target instead of navigating', () => {
    const doc = setBody('<a href="#sec-1">toc</a><h2 id="sec-1">sec</h2>');
    const target = doc.getElementById('sec-1');
    target.scrollIntoView = vi.fn();
    applyLinkPolicy(doc);
    attachLinkHandler(doc, {});

    doc.querySelector('a').click();

    expect(target.scrollIntoView).toHaveBeenCalled();
  });

  it('finds a percent-encoded anchor target', () => {
    const doc = setBody('<a href="#%E8%A6%8B%E5%87%BA%E3%81%97">toc</a><h2 id="見出し">h</h2>');
    const target = doc.getElementById('見出し');
    target.scrollIntoView = vi.fn();
    applyLinkPolicy(doc);
    attachLinkHandler(doc, {});

    doc.querySelector('a').click();

    expect(target.scrollIntoView).toHaveBeenCalled();
  });

  it('does nothing for a blocked link', () => {
    const onExternal = vi.fn();
    const onInternal = vi.fn();
    const doc = setBody('<a href="javascript:alert(1)">x</a>');
    applyLinkPolicy(doc);
    attachLinkHandler(doc, { onExternal, onInternal });

    doc.querySelector('a').click();

    expect(onExternal).not.toHaveBeenCalled();
    expect(onInternal).not.toHaveBeenCalled();
  });

  it('prevents the default action of clicks outside links', () => {
    const doc = setBody('<p>text</p>');
    attachLinkHandler(doc, {});

    const e = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    doc.querySelector('p').dispatchEvent(e);

    expect(e.defaultPrevented).toBe(true);
  });
});
