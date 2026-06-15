import { describe, it, expect } from 'vitest';
import MarkedScript from '@shared/editor/engines/Marked';

describe('MarkedScript', () => {
  it('setVendorUrl stores the URL', () => {
    MarkedScript.setVendorUrl('/test/marked.js');
    expect(MarkedScript._vendorUrl).toBe('/test/marked.js');
  });

  it('isExists returns false when marked is not loaded', () => {
    delete globalThis.marked;
    expect(MarkedScript.isExists()).toBe(false);
  });

  it('reset clears globalThis.marked', () => {
    globalThis.marked = { marked: { setOptions: () => {}, getDefaults: () => ({}) } };
    MarkedScript.reset();
    expect(globalThis.marked).toBeUndefined();
  });
});
