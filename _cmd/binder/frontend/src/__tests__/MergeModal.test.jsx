import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  GetUserInfo: vi.fn(() => Promise.resolve({})),
  RemoteList: vi.fn(() => Promise.resolve([])),
  GetModifiedIds: vi.fn(() => Promise.resolve([])),
  CurrentBranch: vi.fn(() => Promise.resolve('')),
  ListBranches: vi.fn(() => Promise.resolve([])),
  ListRemoteBranches: vi.fn(() => Promise.resolve([])),
  MergeFromRemote: vi.fn(() => Promise.resolve({})),
  MergeFromLocal: vi.fn(() => Promise.resolve({})),
  ApplyMergeResolution: vi.fn(() => Promise.resolve()),
  GetHistoryPatch: vi.fn(() => Promise.resolve('')),
}));
vi.mock('../../bindings/main/window', () => ({
  SelectFileContent: vi.fn(() => Promise.resolve('')),
}));

import MergeModal from '../dialogs/MergeModal';

describe('MergeModal', () => {
  it('renders without crashing when open', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <MergeModal open={true} onClose={() => {}} />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
