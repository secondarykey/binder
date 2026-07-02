import { describe, it, expect, vi } from 'vitest';
import MermaidScript from '@shared/editor/engines/Mermaid';

describe('MermaidScript', () => {
  it('setVendorUrl stores the URL', () => {
    MermaidScript.setVendorUrl('/test/mermaid.js');
    expect(MermaidScript._vendorUrl).toBe('/test/mermaid.js');
  });

  it('isExists returns false when mermaid is not loaded', () => {
    delete globalThis.mermaid;
    expect(MermaidScript.isExists()).toBe(false);
  });

  it('reset clears globalThis.mermaid', () => {
    globalThis.mermaid = {};
    MermaidScript.reset();
    expect(globalThis.mermaid).toBeUndefined();
  });

  it('setStyleTemplate and getStylePrefix work together', () => {
    MermaidScript.setStyleTemplate('test-id', '{"theme":"dark"}');
    const prefix = MermaidScript.getStylePrefix('test-id');
    expect(prefix).toContain('%%{init:{"theme":"dark"}}%%');
  });

  it('getStylePrefix returns empty for unknown id', () => {
    expect(MermaidScript.getStylePrefix('nonexistent')).toBe('');
    expect(MermaidScript.getStylePrefix(null)).toBe('');
  });
});

describe('MermaidScript SVG cache', () => {
  const installMock = () => {
    const mock = {
      parse: vi.fn().mockResolvedValue(true),
      render: vi.fn().mockResolvedValue({ svg: '<svg/>' }),
    };
    globalThis.mermaid = mock;
    return mock;
  };

  it('does not re-render the same text twice', async () => {
    const mock = installMock();
    await MermaidScript.parse('graph TD; cacheA');
    await MermaidScript.parse('graph TD; cacheA');
    expect(mock.render).toHaveBeenCalledTimes(1);
    delete globalThis.mermaid;
  });

  it('re-renders after reset', async () => {
    let mock = installMock();
    await MermaidScript.parse('graph TD; cacheB');
    MermaidScript.reset();
    mock = installMock();
    await MermaidScript.parse('graph TD; cacheB');
    expect(mock.render).toHaveBeenCalledTimes(1);
    delete globalThis.mermaid;
  });

  it('misses the cache when style template content changes', async () => {
    const mock = installMock();
    MermaidScript.setStyleTemplate('cache-style', '{"theme":"dark"}');
    await MermaidScript.parse('graph TD; cacheC', 'cache-style');
    // スタイル内容が変わるとキー（fullTxt）が変わるため再レンダリングされる
    MermaidScript.setStyleTemplate('cache-style', '{"theme":"forest"}');
    await MermaidScript.parse('graph TD; cacheC', 'cache-style');
    expect(mock.render).toHaveBeenCalledTimes(2);
    delete globalThis.mermaid;
  });
});
