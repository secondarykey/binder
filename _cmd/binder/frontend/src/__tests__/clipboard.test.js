import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../bindings/main/window', () => ({
  CopyToClipboard: vi.fn(() => Promise.resolve()),
}));

import { CopyToClipboard } from '../../bindings/main/window';
import { copyClipboard } from '../clipboard';

describe('copyClipboard', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
  const setClipboard = (value) => {
    Object.defineProperty(globalThis.navigator, 'clipboard', { value, configurable: true });
  };

  beforeEach(() => {
    CopyToClipboard.mockReset();
    CopyToClipboard.mockImplementation(() => Promise.resolve());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (original) Object.defineProperty(globalThis.navigator, 'clipboard', original);
    else delete globalThis.navigator.clipboard;
    vi.restoreAllMocks();
  });

  it('uses navigator.clipboard when it works', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    await copyClipboard('abc');
    expect(writeText).toHaveBeenCalledWith('abc');
    expect(CopyToClipboard).not.toHaveBeenCalled();
  });

  it('falls back to Go when navigator.clipboard is missing (Linux release build)', async () => {
    setClipboard(undefined);
    await copyClipboard('abc');
    expect(CopyToClipboard).toHaveBeenCalledWith('abc');
  });

  it('falls back to Go when writeText is rejected', async () => {
    setClipboard({ writeText: vi.fn(() => Promise.reject(new Error('NotAllowedError'))) });
    await copyClipboard('abc');
    expect(CopyToClipboard).toHaveBeenCalledWith('abc');
  });

  it('rejects when Go cannot copy either', async () => {
    setClipboard(undefined);
    CopyToClipboard.mockImplementation(() => Promise.reject(new Error('could not copy')));
    await expect(copyClipboard('abc')).rejects.toThrow('could not copy');
  });
});
