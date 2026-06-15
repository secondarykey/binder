import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/main/window', () => ({
  SelectDirectory: vi.fn(() => Promise.resolve('')),
  OpenOverallHistoryWindow: vi.fn(),
}));

import FileMenu from '../app/FileMenu';

describe('FileMenu', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <FileMenu />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
