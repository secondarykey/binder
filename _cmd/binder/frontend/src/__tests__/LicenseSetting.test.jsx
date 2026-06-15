import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  GetVersionInfo: vi.fn(() => Promise.resolve({})),
}));
vi.mock('../../bindings/binder/api/shared/shared', () => ({
  GetLicense: vi.fn(() => Promise.resolve('')),
  GetThirdPartyLicenses: vi.fn(() => Promise.resolve('')),
}));
vi.mock('../../bindings/main/window', () => ({
  OpenSyslogWindow: vi.fn(),
}));

import LicenseSetting from '../dialogs/LicenseSetting';

describe('LicenseSetting', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <LicenseSetting />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
