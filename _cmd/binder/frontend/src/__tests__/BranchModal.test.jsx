import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  ListBranches: vi.fn(() => Promise.resolve([])),
  CurrentBranch: vi.fn(() => Promise.resolve('main')),
  SwitchBranch: vi.fn(() => Promise.resolve()),
  CreateBranch: vi.fn(() => Promise.resolve()),
  RenameBranch: vi.fn(() => Promise.resolve()),
  GetModifiedIds: vi.fn(() => Promise.resolve([])),
  ListBranchesByPath: vi.fn(() => Promise.resolve([])),
  CurrentBranchByPath: vi.fn(() => Promise.resolve('')),
  SwitchBranchByPath: vi.fn(() => Promise.resolve()),
}));

import { BranchPanel } from '../dialogs/BranchModal';

describe('BranchPanel', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <BranchPanel onClose={() => {}} />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
