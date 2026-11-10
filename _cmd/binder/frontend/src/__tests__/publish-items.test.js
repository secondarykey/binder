import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../bindings/binder/api/app', () => ({
  OpenNote: vi.fn(() => Promise.resolve('saved')),
  OpenDiagram: vi.fn(() => Promise.resolve('graph TD')),
  OpenTemplate: vi.fn(() => Promise.resolve('{"theme":"dark"}')),
  GetDiagram: vi.fn(() => Promise.resolve({ styleTemplate: 'style1' })),
  ParseNote: vi.fn((id, local, text) => Promise.resolve({ html: 'parsed:' + text })),
  ParseDiagram: vi.fn((id, local, text) => Promise.resolve({ html: text })),
}));

vi.mock('../components/editor/engines/Marked', () => ({
  default: { parse: vi.fn((txt) => Promise.resolve('<p>' + txt + '</p>')) },
}));

vi.mock('../components/editor/engines/Mermaid', () => {
  const cache = {};
  return {
    default: {
      parse: vi.fn((txt, style) => Promise.resolve({ svg: `<svg data-style="${style ?? ''}">${txt}</svg>` })),
      hasStyleTemplate: vi.fn((id) => !!cache[id]),
      setStyleTemplate: vi.fn((id, c) => { cache[id] = c; }),
    },
  };
});

import { OpenNote, OpenTemplate, GetDiagram } from '../../bindings/binder/api/app';
import Mermaid from '../components/editor/engines/Mermaid';
import { renderPublishItem, publishComment } from '../publish-items';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('renderPublishItem', () => {
  it('renders a note from the given text', async () => {
    const item = await renderPublishItem({ id: 'n1', type: 'note' }, 'editing');
    expect(item).toEqual({ mode: 'note', id: 'n1', data: '<p>parsed:editing</p>' });
    expect(OpenNote).not.toHaveBeenCalled();
  });

  it('reads the saved note when no text is given', async () => {
    const item = await renderPublishItem({ id: 'n1', type: 'note' });
    expect(OpenNote).toHaveBeenCalledWith('n1');
    expect(item.data).toBe('<p>parsed:saved</p>');
  });

  it('renders a diagram with its style template', async () => {
    const item = await renderPublishItem({ id: 'd1', type: 'diagram', styleTemplate: 'style2' });
    expect(item).toEqual({ mode: 'diagram', id: 'd1', data: '<svg data-style="style2">graph TD</svg>' });
    // スタイルを読み込んでから描く
    expect(OpenTemplate).toHaveBeenCalledWith('style2');
    expect(Mermaid.setStyleTemplate).toHaveBeenCalledWith('style2', '{"theme":"dark"}');
    expect(GetDiagram).not.toHaveBeenCalled();
  });

  it('looks up the style template when the leaf does not have it', async () => {
    const item = await renderPublishItem({ id: 'd1', type: 'diagram' });
    expect(GetDiagram).toHaveBeenCalledWith('d1');
    expect(item.data).toContain('data-style="style1"');
  });

  it('maps assets and layers to their modes', async () => {
    expect(await renderPublishItem({ id: 'a1', type: 'asset' })).toEqual({ mode: 'assets', id: 'a1', data: '' });
    expect(await renderPublishItem({ id: 'l1', type: 'layer' })).toEqual({ mode: 'layer', id: 'l1', data: '' });
  });
});

describe('publishComment', () => {
  it('lists the entries by type', () => {
    const c = publishComment([
      { type: 'asset', name: 'logo.png' },
      { type: 'note', name: 'Intro' },
      { type: 'diagram', name: 'Flow' },
    ]);
    expect(c).toBe('Generate:\n  Note:\n    Intro\n  Diagram:\n    Flow\n  Asset:\n    logo.png');
  });
});
