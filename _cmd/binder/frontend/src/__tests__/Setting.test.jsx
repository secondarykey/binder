import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  GetPath: vi.fn(() => Promise.resolve({})),
  SavePath: vi.fn(() => Promise.resolve()),
  GetTheme: vi.fn(() => Promise.resolve('')),
  SetTheme: vi.fn(() => Promise.resolve()),
  GetLanguage: vi.fn(() => Promise.resolve('')),
  SetLanguage: vi.fn(() => Promise.resolve()),
  GetFont: vi.fn(() => Promise.resolve({})),
  GetAllowedCDNs: vi.fn(() => Promise.resolve([])),
  SaveAllowedCDNs: vi.fn(() => Promise.resolve()),
  GetTreeDisplayMode: vi.fn(() => Promise.resolve('tree')),
  SetTreeDisplayMode: vi.fn(() => Promise.resolve()),
  GetTreeExpandTargets: vi.fn(() => Promise.resolve([])),
  SetTreeExpandTargets: vi.fn(() => Promise.resolve()),
  GetAutoSave: vi.fn(() => Promise.resolve({ enabled: true, intervalMinutes: 30, onClose: true })),
  SaveAutoSave: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../bindings/binder/api/shared/shared', () => ({
  GetThemeList: vi.fn(() => Promise.resolve([])),
  GetLanguageList: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../bindings/main/window', () => ({
  OpenFileDialog: vi.fn(() => Promise.resolve('')),
}));
vi.mock('../dialogs/SnippetSetting', () => ({ default: () => <div>Snippets</div> }));
vi.mock('../dialogs/EditorSetting', () => ({ default: () => <div>Editor</div> }));
vi.mock('../dialogs/GitSetting', () => ({ default: () => <div>Git</div> }));
vi.mock('../dialogs/LicenseSetting', () => ({ default: () => <div>License</div> }));
vi.mock('../dialogs/AppPluginSetting', () => ({ default: () => <div>AppPlugin</div> }));
vi.mock('../theme', () => ({ applyTheme: vi.fn() }));
vi.mock('../language', () => ({ loadLanguage: vi.fn() }));

import Setting from '../dialogs/Setting';

describe('Setting', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <Setting isModal />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
