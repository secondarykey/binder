import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  GetConfig: vi.fn(() => Promise.resolve({})),
  EditConfig: vi.fn(() => Promise.resolve()),
  RemoteList: vi.fn(() => Promise.resolve([])),
  AddRemote: vi.fn(() => Promise.resolve()),
  EditRemote: vi.fn(() => Promise.resolve()),
  DeleteRemote: vi.fn(() => Promise.resolve()),
  GetUserInfo: vi.fn(() => Promise.resolve({})),
  EditUserInfo: vi.fn(() => Promise.resolve()),
  CurrentBranch: vi.fn(() => Promise.resolve('')),
  GetAllowedCDNs: vi.fn(() => Promise.resolve([])),
  RunGC: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../bindings/main/window', () => ({
  SelectFileContent: vi.fn(() => Promise.resolve('')),
}));
vi.mock('../dialogs/PluginSetting', () => ({ default: () => <div>PluginSetting</div> }));
vi.mock('../dialogs/RootFileSetting', () => ({ default: () => <div>RootFileSetting</div> }));

import Binder from '../dialogs/Binder';

describe('Binder', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <Binder isModal />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
