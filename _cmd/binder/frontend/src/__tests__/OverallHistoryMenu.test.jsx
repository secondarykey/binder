import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetOverallHistory: vi.fn(() => Promise.resolve([])),
  GetOverallHistoryByPath: vi.fn(() => Promise.resolve([])),
  GetModifiedIds: vi.fn(() => Promise.resolve([])),
  RestoreToCommit: vi.fn(() => Promise.resolve()),
  RestoreToCommitByPath: vi.fn(() => Promise.resolve()),
  GetCleanupInfo: vi.fn(() => Promise.resolve({})),
  SquashHistory: vi.fn(() => Promise.resolve()),
}));

import OverallHistoryMenu from '../app/OverallHistoryMenu';

describe('OverallHistoryMenu', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <OverallHistoryMenu />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
