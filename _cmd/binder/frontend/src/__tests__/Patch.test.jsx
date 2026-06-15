import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetNowPatch: vi.fn(() => Promise.resolve('')),
  GetFont: vi.fn(() => Promise.resolve({ fontFamily: 'monospace', fontSize: '14px' })),
}));

import Patch from '../components/Patch';

describe('Patch', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <Patch type="note" currentId="abc-123" />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
