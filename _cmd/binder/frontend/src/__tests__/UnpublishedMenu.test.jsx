import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  GetUnpublishedTree: vi.fn(() => Promise.resolve([])),
  GetPublishedNotesByTemplate: vi.fn(() => Promise.resolve([])),
  GetPublishedTree: vi.fn(() => Promise.resolve([])),
  OpenNote: vi.fn(() => Promise.resolve('')),
  OpenDiagram: vi.fn(() => Promise.resolve('')),
  ParseNote: vi.fn(() => Promise.resolve('')),
  ParseDiagram: vi.fn(() => Promise.resolve('')),
  GenerateAll: vi.fn(() => Promise.resolve()),
  UnpublishAll: vi.fn(() => Promise.resolve()),
}));

import UnpublishedMenu from '../dialogs/UnpublishedMenu';

describe('UnpublishedMenu', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.PublishGenerate, () => {});
    evt.register('test', Event.ReloadUnpublished, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <MemoryRouter>
            <UnpublishedMenu date="2024-01-01" onClose={() => {}} />
          </MemoryRouter>
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
