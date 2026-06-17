import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetHistories: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../bindings/main/window', () => ({
  OpenOverallHistoryWindow: vi.fn(),
}));

import BinderHistory from '../components/BinderHistory';

describe('BinderHistory', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    const { container } = render(
      <EventContext.Provider value={evt}>
        <BinderHistory />
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
