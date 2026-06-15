import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  GetUserInfo: vi.fn(() => Promise.resolve({})),
  RemoteList: vi.fn(() => Promise.resolve([])),
  Push: vi.fn(() => Promise.resolve()),
  PushDocs: vi.fn(() => Promise.resolve()),
  CurrentBranch: vi.fn(() => Promise.resolve('')),
  GetPublishSettings: vi.fn(() => Promise.resolve({})),
}));
vi.mock('../../bindings/main/window', () => ({
  SelectFileContent: vi.fn(() => Promise.resolve('')),
}));

import PushModal from '../dialogs/PushModal';

describe('PushModal', () => {
  it('renders without crashing when open', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <PushModal open={true} onClose={() => {}} />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
