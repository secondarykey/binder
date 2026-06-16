import { describe, it, expect } from 'vitest';
import { extractUuidAtCursor } from '@shared/editor/id-detect';

describe('extractUuidAtCursor', () => {
  const uuid = '019064da-7b5c-7c9a-8e5f-abc123def456';

  it('detects UUID when cursor is at the start', () => {
    expect(extractUuidAtCursor(uuid, 0)).toBe(uuid);
  });

  it('detects UUID when cursor is in the middle', () => {
    expect(extractUuidAtCursor(uuid, 18)).toBe(uuid);
  });

  it('detects UUID when cursor is at the end', () => {
    expect(extractUuidAtCursor(uuid, uuid.length)).toBe(uuid);
  });

  it('detects UUID embedded in text', () => {
    const text = `Link to ${uuid} here`;
    expect(extractUuidAtCursor(text, 10)).toBe(uuid);
  });

  it('returns null for non-UUID text', () => {
    expect(extractUuidAtCursor('hello world', 5)).toBeNull();
  });

  it('returns null for empty text', () => {
    expect(extractUuidAtCursor('', 0)).toBeNull();
  });

  it('returns null for partial UUID', () => {
    expect(extractUuidAtCursor('019064da-7b5c', 5)).toBeNull();
  });

  it('detects UUID on line boundary', () => {
    const text = `line1\n${uuid}\nline3`;
    expect(extractUuidAtCursor(text, 6 + 10)).toBe(uuid);
  });
});
