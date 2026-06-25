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
    expect(r.kind).toBeUndefined();
  });

  it('extracts kind from structured cause', () => {
    const env = JSON.stringify({
      message: 'No changes',
      cause: { body: 'No changes to record', kind: 'info' },
      kind: 'RuntimeError',
    });
    const r = parseError(new Error(env));
    expect(r.body).toBe('No changes to record');
    expect(r.kind).toBe('info');
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
    expect(r.kind).toBeUndefined();
  });

  it('treats a plain (non-JSON) string as the body', () => {
    const r = parseError('Please record changes before switching branches.');
    expect(r.body).toBe('Please record changes before switching branches.');
    expect(r.detail).toBe('');
    expect(r.kind).toBeUndefined();
  });

  it('handles a plain Error message', () => {
    const r = parseError(new Error('boom'));
    expect(r.body).toBe('boom');
  });

  it('handles null/undefined gracefully', () => {
    expect(parseError(null).body).toBe('Unknown error');
    expect(parseError(undefined).body).toBe('Unknown error');
  });

  it('normalizes Wails v3 panic messages to user-friendly body', () => {
    const env = JSON.stringify({
      message: 'binder/api.(*App).RemoveNote: panic: runtime error: index out of range',
      cause: {},
      kind: 'RuntimeError',
    });
    const r = parseError(new Error(env));
    expect(r.body).not.toContain('panic');
    expect(r.body.length).toBeGreaterThan(0);
    expect(r.debug).toContain('panic');
    expect(r.debug).toContain('index out of range');
    expect(r.detail).toBe('');
  });
});
