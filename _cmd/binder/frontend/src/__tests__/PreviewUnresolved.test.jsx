import { describe, it, expect, beforeEach } from 'vitest';
import { markUnresolvedResources, isUnresolvedSrc, unresolvedKind, UNRESOLVED_STYLE_ID } from '@shared/editor/preview-unresolved';

// jsdom の document をプレビュー iframe の contentDocument に見立てて検証する
function setBody(html) {
  document.body.innerHTML = html;
  return document;
}

const LABEL = 'プレビューでは表示できません';
const HINTS = {
  diagram: 'drawDiagram が使えます',
  layer: 'drawLayer が使えます',
  asset: 'assetsImage が使えます',
};

describe('isUnresolvedSrc', () => {
  it('treats data and absolute URLs as loadable', () => {
    expect(isUnresolvedSrc('data:image/png;base64,AAAA')).toBe(false);
    expect(isUnresolvedSrc('blob:x')).toBe(false);
    expect(isUnresolvedSrc('https://example.com/a.png')).toBe(false);
    expect(isUnresolvedSrc('//example.com/a.png')).toBe(false);
  });

  it('treats publish-relative paths as unloadable', () => {
    expect(isUnresolvedSrc('../images/x.svg')).toBe(true);
    expect(isUnresolvedSrc('/assets/x.png')).toBe(true);
    expect(isUnresolvedSrc('foo.png')).toBe(true);
  });

  it('ignores an empty src', () => {
    expect(isUnresolvedSrc('')).toBe(false);
  });
});

describe('unresolvedKind', () => {
  it('derives the kind from the published path', () => {
    expect(unresolvedKind('../images/x.svg')).toBe('diagram');
    expect(unresolvedKind('/images/x.svg')).toBe('diagram');
    expect(unresolvedKind('../layers/l.svg')).toBe('layer');
    expect(unresolvedKind('../assets/a.png')).toBe('asset');
  });

  it('returns null when the path says nothing', () => {
    expect(unresolvedKind('foo.png')).toBeNull();
    expect(unresolvedKind('../pages/p.html')).toBeNull();
    expect(unresolvedKind('')).toBeNull();
  });
});

describe('markUnresolvedResources', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.getElementById(UNRESOLVED_STYLE_ID)?.remove();
  });

  it('replaces an unloadable image with a visible placeholder', () => {
    const doc = setBody('<p><img src="../images/x.svg"></p>');
    const count = markUnresolvedResources(doc, LABEL);

    expect(count).toBe(1);
    // 壊れた画像アイコンを残さない
    expect(doc.querySelector('img')).toBeNull();
    const box = doc.querySelector('.binderUnresolved');
    expect(box).not.toBeNull();
    expect(box.textContent).toContain(LABEL);
    // どの参照が解決できなかったのかも見せる
    expect(box.textContent).toContain('../images/x.svg');
    expect(box.getAttribute('title')).toBe('../images/x.svg');
    expect(doc.getElementById(UNRESOLVED_STYLE_ID)).not.toBeNull();
  });

  it('leaves loadable images alone', () => {
    const doc = setBody('<img src="data:image/png;base64,AAAA"><img src="https://example.com/a.png">');
    const count = markUnresolvedResources(doc, LABEL);

    expect(count).toBe(0);
    expect(doc.querySelectorAll('img')).toHaveLength(2);
    // 対象が無ければスタイルも注入しない
    expect(doc.getElementById(UNRESOLVED_STYLE_ID)).toBeNull();
  });

  it('replaces every unloadable image', () => {
    const doc = setBody('<img src="a.png"><img src="data:image/png;base64,AAAA"><img src="../assets/b.png">');
    expect(markUnresolvedResources(doc, LABEL)).toBe(2);
    expect(doc.querySelectorAll('.binderUnresolved')).toHaveLength(2);
    expect(doc.querySelectorAll('img')).toHaveLength(1);
  });
});

describe('markUnresolvedResources hints', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.getElementById(UNRESOLVED_STYLE_ID)?.remove();
  });

  it('suggests the function that also works in the preview', () => {
    const doc = setBody('<img src="../images/x.svg">');
    markUnresolvedResources(doc, LABEL, HINTS);

    const box = doc.querySelector('.binderUnresolved');
    expect(box.textContent).toContain(LABEL);
    expect(box.querySelector('.binderUnresolvedHint').textContent).toBe(HINTS.diagram);
  });

  it('picks the hint per kind', () => {
    const doc = setBody('<img src="../assets/a.png"><img src="../layers/l.svg">');
    markUnresolvedResources(doc, LABEL, HINTS);

    const hints = [...doc.querySelectorAll('.binderUnresolvedHint')].map(e => e.textContent);
    expect(hints).toEqual([HINTS.asset, HINTS.layer]);
  });

  it('omits the hint when the path says nothing', () => {
    const doc = setBody('<img src="foo.png">');
    markUnresolvedResources(doc, LABEL, HINTS);

    expect(doc.querySelector('.binderUnresolvedHint')).toBeNull();
    expect(doc.querySelector('.binderUnresolved').textContent).toContain(LABEL);
  });

  it('omits the hint where the app has no such functions (Lite)', () => {
    const doc = setBody('<img src="../images/x.svg">');
    markUnresolvedResources(doc, LABEL);

    expect(doc.querySelector('.binderUnresolvedHint')).toBeNull();
  });
});
