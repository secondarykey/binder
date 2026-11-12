import { describe, it, expect } from 'vitest';
import { countChars } from '@shared/editor/char-count';

describe('countChars', () => {
  it('空は 0', () => {
    expect(countChars('')).toBe(0);
    expect(countChars(null)).toBe(0);
    expect(countChars(undefined)).toBe(0);
  });

  it('改行は数えない', () => {
    expect(countChars('ab\ncd\r\nef')).toBe(6);
  });

  it('絵文字（サロゲートペア）は 1 文字', () => {
    expect(countChars('a😀b')).toBe(3);
    expect(countChars('😀😀\n😀')).toBe(3);
  });

  it('対になっていないサロゲートも 1 文字', () => {
    expect(countChars('\ud83dx')).toBe(2);
    expect(countChars('x\ude00')).toBe(2);
    expect(countChars('x\ud83d')).toBe(2);
  });

  it('文字を 1 つずつ取り出して数えた結果と同じ', () => {
    const text = 'これは本文。Markdown 😀\r\n\t- list 𠮷野家\n\n'.repeat(50);
    let want = 0;
    for (const ch of text) {
      if (ch !== '\n' && ch !== '\r') want++;
    }
    expect(countChars(text)).toBe(want);
  });
});
