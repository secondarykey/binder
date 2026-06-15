import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/main/window', () => ({
  SelectDirectory: vi.fn(() => Promise.resolve('')),
}));
vi.mock('../../bindings/binder/api/app', () => ({
  CreateBinder: vi.fn(() => Promise.resolve()),
  GetGit: vi.fn(() => Promise.resolve({})),
  GetInstallPresets: vi.fn(() => Promise.resolve([])),
}));

import BinderRegister from '../components/BinderRegister';

describe('BinderRegister', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <BinderRegister />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
