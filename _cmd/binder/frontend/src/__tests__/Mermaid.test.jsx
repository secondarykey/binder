import { describe, it, expect } from 'vitest';
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
