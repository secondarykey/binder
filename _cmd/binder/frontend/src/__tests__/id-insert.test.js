import { describe, it, expect } from 'vitest';
import { idInsertText, isInsideTemplate } from '../components/editor/id-insert';

describe('idInsertText', () => {
  const id = '019064da-7b5c-7c9a-8e5f-abc123def456';

  it('inserts the function that fits the type', () => {
    expect(idInsertText({ id, type: 'note' }, true)).toBe(`{{link "${id}"}}`);
    expect(idInsertText({ id, type: 'diagram' }, true)).toBe(`{{drawDiagram "${id}"}}`);
    expect(idInsertText({ id, type: 'layer' }, true)).toBe(`{{drawLayer "${id}"}}`);
  });

  it('uses assetsImage only for image assets', () => {
    expect(idInsertText({ id, type: 'asset', mime: 'image/png' }, true)).toBe(`{{assetsImage "${id}"}}`);
    expect(idInsertText({ id, type: 'asset', mime: 'image/svg+xml' }, true)).toBe(`{{assetsImage "${id}"}}`);
    expect(idInsertText({ id, type: 'asset', mime: 'application/pdf' }, true)).toBe(`{{link "${id}"}}`);
    expect(idInsertText({ id, type: 'asset' }, true)).toBe(`{{link "${id}"}}`);
  });

  it('inserts only the ID when withFunc is false or the type is unknown', () => {
    expect(idInsertText({ id, type: 'note' }, false)).toBe(id);
    expect(idInsertText({ id, type: 'template' }, true)).toBe(id);
  });
});

describe('isInsideTemplate', () => {
  it('detects a cursor inside {{ }}', () => {
    const text = '{{link "';
    expect(isInsideTemplate(text, text.length)).toBe(true);
    expect(isInsideTemplate('{{link ""}}', 8)).toBe(true);
  });

  it('returns false outside {{ }}', () => {
    expect(isInsideTemplate('', 0)).toBe(false);
    expect(isInsideTemplate('text ', 5)).toBe(false);
    const text = '{{link "a"}} next ';
    expect(isInsideTemplate(text, text.length)).toBe(false);
  });
});
