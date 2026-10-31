import { describe, it, expect } from 'vitest';
import { clipboardImage, fileToBase64, markdownImage, isRelativeImageSrc } from '@shared/editor/image-paste';

// DataTransfer の代わり（jsdom には DataTransfer が無い）
const clipboard = ({ text = '', files = [] }) => ({
  getData: (type) => (type === 'text/plain' ? text : ''),
  items: files.map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f })),
});

describe('clipboardImage', () => {
  it('returns the image and its extension', () => {
    const png = new File(['x'], 'image.png', { type: 'image/png' });
    expect(clipboardImage(clipboard({ files: [png] }))).toEqual({ file: png, ext: '.png' });
    const jpg = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    expect(clipboardImage(clipboard({ files: [jpg] })).ext).toBe('.jpg');
  });

  it('prefers text when the clipboard also has text', () => {
    const png = new File(['x'], 'image.png', { type: 'image/png' });
    expect(clipboardImage(clipboard({ text: 'A\tB', files: [png] }))).toBeNull();
  });

  it('ignores non-image files and empty clipboards', () => {
    const pdf = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    expect(clipboardImage(clipboard({ files: [pdf] }))).toBeNull();
    expect(clipboardImage(clipboard({}))).toBeNull();
    expect(clipboardImage(null)).toBeNull();
  });
});

describe('fileToBase64', () => {
  it('returns base64 without the data URI header', async () => {
    const f = new File(['abc'], 'a.png', { type: 'image/png' });
    expect(await fileToBase64(f)).toBe(btoa('abc'));
  });
});

describe('markdownImage', () => {
  it('wraps paths with spaces or parentheses in <>', () => {
    expect(markdownImage('memo.assets/1.png')).toBe('![](memo.assets/1.png)');
    expect(markdownImage('my memo.assets/1.png')).toBe('![](<my memo.assets/1.png>)');
    expect(markdownImage('a(1).assets/1.png')).toBe('![](<a(1).assets/1.png>)');
  });
});

describe('isRelativeImageSrc', () => {
  it('accepts relative paths', () => {
    expect(isRelativeImageSrc('memo.assets/1.png')).toBe(true);
    expect(isRelativeImageSrc('./a.png')).toBe(true);
    expect(isRelativeImageSrc('../img/a.png')).toBe(true);
  });

  it('rejects URLs, data URIs, root paths and anchors', () => {
    for (const src of ['https://example.com/a.png', 'data:image/png;base64,AA', 'blob:x', '/a.png', '\\a.png', '#x', '']) {
      expect(isRelativeImageSrc(src)).toBe(false);
    }
  });
});
