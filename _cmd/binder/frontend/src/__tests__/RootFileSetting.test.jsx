import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  ListRootFiles: vi.fn(() => Promise.resolve([])),
  ReadRootFile: vi.fn(() => Promise.resolve('')),
  WriteRootFile: vi.fn(() => Promise.resolve()),
  DeleteRootFile: vi.fn(() => Promise.resolve()),
  RenameRootFile: vi.fn(() => Promise.resolve()),
}));

import RootFileSetting from '../dialogs/RootFileSetting';

describe('RootFileSetting', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <RootFileSetting />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
