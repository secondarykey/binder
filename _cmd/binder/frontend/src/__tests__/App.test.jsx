import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../app/Menu', () => ({ default: () => <div>Menu</div> }));
vi.mock('../app/Content', () => ({ default: () => <div>Content</div> }));
vi.mock('../dialogs/CommitModal', () => ({ default: () => null }));
vi.mock('../dialogs/PublishModal', () => ({ default: () => null }));
vi.mock('../dialogs/SettingModal', () => ({ default: () => null }));
vi.mock('../dialogs/BinderModal', () => ({ default: () => null }));
vi.mock('../dialogs/PushModal', () => ({ default: () => null }));
vi.mock('../dialogs/MergeModal', () => ({ default: () => null }));
vi.mock('../app/BranchHistoryModal', () => ({ default: () => null }));
vi.mock('../dialogs/components/ConvertDialog', () => ({
  default: () => null,
  NeedUpdateDialog: () => null,
  TooOldDialog: () => null,
}));
vi.mock('../../bindings/binder/api/app', () => ({
  GetPath: vi.fn(() => Promise.resolve({})),
  GetConfig: vi.fn(() => Promise.resolve({})),
  GetVersionInfo: vi.fn(() => Promise.resolve({})),
  CloseBinder: vi.fn(() => Promise.resolve()),
  LoadBinder: vi.fn(() => Promise.resolve()),
  CheckCompat: vi.fn(() => Promise.resolve({})),
  Convert: vi.fn(() => Promise.resolve()),
  GetAutoSave: vi.fn(() => Promise.resolve({ enabled: false, intervalMinutes: 30, onClose: true })),
  AutoSave: vi.fn(() => Promise.resolve(0)),
}));
vi.mock('../../bindings/main/window', () => ({
  SavePosition: vi.fn(() => Promise.resolve()),
  Terminate: vi.fn(() => Promise.resolve()),
  OpenSyslogWindow: vi.fn(),
}));

import App from '../app/App';

describe('App', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ChangeAddress, () => {});
    evt.register('test', Event.OpenBinder, () => {});
    evt.register('test', Event.OpenCommitModal, () => {});
    evt.register('test', Event.OpenSettingModal, () => {});
    evt.register('test', Event.OpenBinderModal, () => {});
    evt.register('test', Event.OpenPublishModal, () => {});
    evt.register('test', Event.OpenPushModal, () => {});
    evt.register('test', Event.OpenMergeModal, () => {});
    evt.register('test', Event.OpenBranchModal, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
