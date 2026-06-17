import { describe, it, expect } from 'vitest';
import { extractUuidsOnLine, extractUuidAtCursor } from '@shared/editor/id-detect';

describe('extractUuidsOnLine', () => {
  const uuid1 = '019064da-7b5c-7c9a-8e5f-abc123def456';
  const uuid2 = 'aabbccdd-1122-4334-9955-667788990011';

  it('detects UUID on the cursor line', () => {
    const text = `line1\n${uuid1}\nline3`;
    const result = extractUuidsOnLine(text, 6 + 10);
    expect(result).toEqual([uuid1]);
  });

  it('returns empty array when no UUID on line', () => {
    expect(extractUuidsOnLine('hello world', 5)).toEqual([]);
  });

  it('returns empty array for empty text', () => {
    expect(extractUuidsOnLine('', 0)).toEqual([]);
  });

  it('detects multiple UUIDs on same line, closest first', () => {
    const text = `prefix ${uuid1} middle ${uuid2} suffix`;
    const cursorNearSecond = text.indexOf(uuid2) + 5;
    const result = extractUuidsOnLine(text, cursorNearSecond);
    expect(result).toEqual([uuid2, uuid1]);
  });

  it('detects multiple UUIDs on same line, closest first (cursor near first)', () => {
    const text = `prefix ${uuid1} middle ${uuid2} suffix`;
    const cursorNearFirst = text.indexOf(uuid1) + 5;
    const result = extractUuidsOnLine(text, cursorNearFirst);
    expect(result).toEqual([uuid1, uuid2]);
  });

  it('does not detect UUID on a different line', () => {
    const text = `${uuid1}\nhello`;
    const result = extractUuidsOnLine(text, text.indexOf('hello') + 2);
    expect(result).toEqual([]);
  });
});

describe('extractUuidAtCursor (backward compat)', () => {
  const uuid = '019064da-7b5c-7c9a-8e5f-abc123def456';

  it('returns closest UUID', () => {
    const text = `Link to ${uuid} here`;
    expect(extractUuidAtCursor(text, 10)).toBe(uuid);
  });

  it('returns null when no UUID', () => {
    expect(extractUuidAtCursor('hello', 3)).toBeNull();
  });
});
