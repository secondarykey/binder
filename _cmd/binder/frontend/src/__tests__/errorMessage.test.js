import { describe, it, expect } from 'vitest';
import { errorMessage } from '@shared/error-message';

describe('errorMessage', () => {
  it('takes the Go error text out of the Wails envelope', () => {
    const envelope = JSON.stringify({
      message: 'SaveFileDialog() error\nfailed to open dialog\n',
      cause: {},
      kind: 'RuntimeError',
    });
    expect(errorMessage(new Error(envelope))).toBe('SaveFileDialog() error\nfailed to open dialog');
  });

  it('uses the message of a frontend error as it is', () => {
    expect(errorMessage(new Error('Failed to fetch'))).toBe('Failed to fetch');
  });

  it('accepts a plain string', () => {
    expect(errorMessage('something went wrong')).toBe('something went wrong');
  });

  it('does not take a JSON without message for the envelope', () => {
    expect(errorMessage(new Error('{"code":1}'))).toBe('{"code":1}');
  });

  it('returns an empty string for nothing', () => {
    expect(errorMessage(undefined)).toBe('');
    expect(errorMessage(null)).toBe('');
  });

  it('stringifies a non-string value', () => {
    expect(errorMessage(42)).toBe('42');
  });
});
