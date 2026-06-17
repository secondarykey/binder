import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  ListPlugins: vi.fn(() => Promise.resolve([])),
  SavePlugin: vi.fn(() => Promise.resolve()),
  DeletePlugin: vi.fn(() => Promise.resolve()),
  RenamePlugin: vi.fn(() => Promise.resolve()),
  ListAppPlugins: vi.fn(() => Promise.resolve([])),
  InstallAppPlugin: vi.fn(() => Promise.resolve()),
}));

import PluginSetting from '../dialogs/PluginSetting';

describe('PluginSetting', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <PluginSetting engine="marked" />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
