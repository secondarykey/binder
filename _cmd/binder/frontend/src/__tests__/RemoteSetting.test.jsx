import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  RemoteList: vi.fn(() => Promise.resolve([])),
  AddRemote: vi.fn(() => Promise.resolve()),
  EditRemote: vi.fn(() => Promise.resolve()),
  DeleteRemote: vi.fn(() => Promise.resolve()),
}));

import RemoteSetting from '../dialogs/RemoteSetting';

describe('RemoteSetting', () => {
  it('renders without crashing when open', () => {
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <DialogErrorContext.Provider value={ctx}>
        <RemoteSetting open={true} onClose={() => {}} />
      </DialogErrorContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
