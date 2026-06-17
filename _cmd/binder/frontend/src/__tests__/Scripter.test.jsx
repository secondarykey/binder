import { describe, it, expect } from 'vitest';
import Scripter from '@shared/editor/engines/Scripter';

describe('Scripter', () => {
  it('isAllowedUrl returns true for matching domain', () => {
    expect(Scripter.isAllowedUrl('https://cdn.example.com/lib.js', ['example.com'])).toBe(true);
  });

  it('isAllowedUrl returns true for subdomain match', () => {
    expect(Scripter.isAllowedUrl('https://cdn.example.com/lib.js', ['example.com'])).toBe(true);
  });

  it('isAllowedUrl returns false for non-matching domain', () => {
    expect(Scripter.isAllowedUrl('https://evil.com/lib.js', ['example.com'])).toBe(false);
  });

  it('isAllowedUrl returns false for empty input', () => {
    expect(Scripter.isAllowedUrl('', ['example.com'])).toBe(false);
    expect(Scripter.isAllowedUrl('https://example.com', [])).toBe(false);
    expect(Scripter.isAllowedUrl(null, null)).toBe(false);
  });

  it('isAllowedUrl returns false for invalid URL', () => {
    expect(Scripter.isAllowedUrl('not-a-url', ['example.com'])).toBe(false);
  });
});
