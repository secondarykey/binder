import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetCommitFiles: vi.fn(() => Promise.resolve([])),
  GetCommitFilesByPath: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../bindings/main/window', () => ({
  OpenHistoryWindow: vi.fn(),
}));

import OverallHistoryDetail from '../app/OverallHistoryDetail';

describe('OverallHistoryDetail', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <OverallHistoryDetail hash="abc123" />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
