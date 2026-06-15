import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  GetModifiedTree: vi.fn(() => Promise.resolve([])),
  CommitFiles: vi.fn(() => Promise.resolve()),
}));

import ModifiedMenu from '../dialogs/ModifiedMenu';

describe('ModifiedMenu', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ModifiedCommit, () => {});
    evt.register('test', Event.CommitDone, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <MemoryRouter>
            <ModifiedMenu date="2024-01-01" onNavigate={() => {}} onClose={() => {}} />
          </MemoryRouter>
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
