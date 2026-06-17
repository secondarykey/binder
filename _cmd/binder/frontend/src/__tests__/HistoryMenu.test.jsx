import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetHistory: vi.fn(() => Promise.resolve([])),
  GetModifiedIds: vi.fn(() => Promise.resolve([])),
  RestoreHistory: vi.fn(() => Promise.resolve()),
}));

import HistoryMenu from '../app/HistoryMenu';

describe('HistoryMenu', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter initialEntries={['/history/note/abc']}>
          <HistoryMenu />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
