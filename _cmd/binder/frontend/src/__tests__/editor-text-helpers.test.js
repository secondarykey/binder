import { describe, it, expect } from 'vitest';
import { linkFromPaste } from '@shared/editor/markdown-keys';
import { countChars } from '@shared/editor/char-count';

describe('linkFromPaste', () => {
  it('makes a link from the selection and a pasted URL', () => {
    expect(linkFromPaste('Binder', 'https://example.com/a?b=1')).toBe('[Binder](https://example.com/a?b=1)');
    expect(linkFromPaste('Binder', '  http://example.com\n')).toBe('[Binder](http://example.com)');
  });

  it('does nothing without a selection or with a non-URL', () => {
    expect(linkFromPaste('', 'https://example.com')).toBeNull();
    expect(linkFromPaste('Binder', 'example.com')).toBeNull();
    expect(linkFromPaste('Binder', 'https://example.com and more')).toBeNull();
    expect(linkFromPaste('Binder', 'https://a.com\nhttps://b.com')).toBeNull();
  });

  it('does nothing when the selection spans lines or is a URL itself', () => {
    expect(linkFromPaste('line1\nline2', 'https://example.com')).toBeNull();
    expect(linkFromPaste('https://old.example.com', 'https://example.com')).toBeNull();
  });
});

describe('countChars', () => {
  it('counts characters without line breaks', () => {
    expect(countChars('')).toBe(0);
    expect(countChars(undefined)).toBe(0);
    expect(countChars('あいう')).toBe(3);
    expect(countChars('ab\ncd\r\ne')).toBe(5);
  });

  it('counts a surrogate pair as one character', () => {
    expect(countChars('𠮷野家😀')).toBe(4);
  });
});
