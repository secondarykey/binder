import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetConfig: vi.fn(() => Promise.resolve({})),
}));

import PreviewApp from '../app/PreviewApp';

describe('PreviewApp', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <PreviewApp />
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
