import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  CreateRemoteBinder: vi.fn(() => Promise.resolve()),
  GetGit: vi.fn(() => Promise.resolve({})),
  ListRemoteBranches: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../bindings/main/window', () => ({
  SelectDirectory: vi.fn(() => Promise.resolve('')),
  SelectFileContent: vi.fn(() => Promise.resolve('')),
}));

import BinderRemote from '../components/BinderRemote';

describe('BinderRemote', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <BinderRemote />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
