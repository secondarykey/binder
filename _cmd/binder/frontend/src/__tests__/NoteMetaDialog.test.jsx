import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetNote: vi.fn(() => Promise.resolve({})),
  GetHTMLTemplates: vi.fn(() => Promise.resolve([])),
  GetNoteImageURL: vi.fn(() => Promise.resolve('')),
  DeleteNoteImage: vi.fn(() => Promise.resolve()),
  UploadNoteImage: vi.fn(() => Promise.resolve()),
  EditNote: vi.fn(() => Promise.resolve()),
  RemoveNote: vi.fn(() => Promise.resolve()),
  PrivatizeChildren: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../bindings/main/window', () => ({
  SelectFile: vi.fn(() => Promise.resolve('')),
  OpenSearchWindowWithQuery: vi.fn(),
}));
vi.mock('../app/App', () => ({ copyClipboard: vi.fn() }));

import NoteMetaDialog from '../dialogs/NoteMetaDialog';

describe('NoteMetaDialog', () => {
  it('renders without crashing when open', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <NoteMetaDialog open={true} id="test-id" onClose={() => {}} />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    const evt = new Event();
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <NoteMetaDialog open={false} id="" onClose={() => {}} />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
