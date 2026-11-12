import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  GetVersionInfo: vi.fn(() => Promise.resolve({})),
}));
vi.mock('../../bindings/main/window', () => ({
  OpenSyslogWindow: vi.fn(),
}));

import LicenseSetting from '../dialogs/LicenseSetting';
import { license, thirdPartyLicenses } from '@shared/licenses';

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

  it('ルートの LICENSE と THIRD_PARTY_LICENSES の中身を表示する', () => {
    const evt = new Event();
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <LicenseSetting />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    const text = container.textContent;
    expect(text).toContain(license.trim().split(/\r?\n/)[0]);
    expect(text).toContain(thirdPartyLicenses.trim().split(/\r?\n/)[0]);
    expect(license.length).toBeGreaterThan(100);
    expect(thirdPartyLicenses.length).toBeGreaterThan(100);
  });
});
