import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  ListAppPlugins: vi.fn(() => Promise.resolve([])),
  SaveAppPlugin: vi.fn(() => Promise.resolve()),
  DeleteAppPlugin: vi.fn(() => Promise.resolve()),
  RenameAppPlugin: vi.fn(() => Promise.resolve()),
}));

import AppPluginSetting from '../dialogs/AppPluginSetting';

describe('AppPluginSetting', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <AppPluginSetting engine="marked" />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
