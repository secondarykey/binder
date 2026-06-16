import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../../bindings/binder/api/app', () => ({
  GetNote: vi.fn(() => Promise.resolve({})),
  ParseNote: vi.fn(() => Promise.resolve('')),
  OpenNote: vi.fn(() => Promise.resolve('')),
  GetDiagram: vi.fn(() => Promise.resolve({})),
  ParseDiagram: vi.fn(() => Promise.resolve('')),
  OpenDiagram: vi.fn(() => Promise.resolve('')),
  SaveContent: vi.fn(() => Promise.resolve()),
  GetConfig: vi.fn(() => Promise.resolve({})),
  GetFont: vi.fn(() => Promise.resolve({})),
  Generate: vi.fn(() => Promise.resolve()),
  Unpublish: vi.fn(() => Promise.resolve()),
  Commit: vi.fn(() => Promise.resolve()),
  GetModifiedIds: vi.fn(() => Promise.resolve([])),
  EnsureAddress: vi.fn(() => Promise.resolve('')),
  GetSnippets: vi.fn(() => Promise.resolve({ markdowns: [], diagrams: [], templates: [] })),
  GetStructure: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../../bindings/main/window', () => ({
  OpenHistoryWindow: vi.fn(),
  OpenPreviewWindow: vi.fn(),
  OpenSearchWindowWithQuery: vi.fn(),
}));

import Component from '../components/editor/Component';

describe('EditorComponent', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.InsertText, () => {});
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter initialEntries={['/note/test-id']}>
          <Component />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
