import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  RemoteList: vi.fn(() => Promise.resolve([])),
  AddRemote: vi.fn(() => Promise.resolve()),
  EditRemote: vi.fn(() => Promise.resolve()),
  DeleteRemote: vi.fn(() => Promise.resolve()),
}));

import RemoteSelect from '../components/RemoteSelect';

describe('RemoteSelect', () => {
  it('renders without crashing', () => {
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <DialogErrorContext.Provider value={ctx}>
        <RemoteSelect value="" onChange={() => {}} />
      </DialogErrorContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
