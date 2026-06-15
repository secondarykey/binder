import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../app/HistoryMenu', () => ({ default: () => <div>HistoryMenu</div> }));
vi.mock('../app/HistoryPatch', () => ({ default: () => <div>HistoryPatch</div> }));

import HistoryApp from '../app/HistoryApp';

describe('HistoryApp', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <HistoryApp />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
