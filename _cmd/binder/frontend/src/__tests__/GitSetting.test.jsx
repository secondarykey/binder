import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetGit: vi.fn(() => Promise.resolve({})),
  SaveGit: vi.fn(() => Promise.resolve()),
}));

import GitSetting from '../dialogs/GitSetting';

describe('GitSetting', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <GitSetting />
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
