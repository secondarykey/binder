import { describe, it, expect } from 'vitest';
import { parseError } from '../error';

describe('parseError', () => {
  it('extracts body/detail/debug from a structured (cause) envelope', () => {
    const env = JSON.stringify({
      message: 'RemoveNote() error',
      cause: { body: 'BODY', detail: 'DETAIL', cause: 'low level' },
      kind: 'RuntimeError',
    });
    const r = parseError(new Error(env));
    expect(r.body).toBe('BODY');
    expect(r.detail).toBe('DETAIL');
    expect(r.debug).toContain('low level');
  });

  it('falls back to the first line of message when cause has no body', () => {
    const env = JSON.stringify({
      message: 'GetNote() error\nstack a\nstack b',
      cause: {},
      kind: 'RuntimeError',
    });
    const r = parseError(new Error(env));
    expect(r.body).toBe('GetNote() error');
    expect(r.detail).toContain('stack a');
    expect(r.debug).toContain('stack b');
  });

  it('treats a plain (non-JSON) string as the body', () => {
    const r = parseError('Please record changes before switching branches.');
    expect(r.body).toBe('Please record changes before switching branches.');
    expect(r.detail).toBe('');
  });

  it('handles a plain Error message', () => {
    const r = parseError(new Error('boom'));
    expect(r.body).toBe('boom');
  });

  it('handles null/undefined gracefully', () => {
    expect(parseError(null).body).toBe('Unknown error');
    expect(parseError(undefined).body).toBe('Unknown error');
  });
});
