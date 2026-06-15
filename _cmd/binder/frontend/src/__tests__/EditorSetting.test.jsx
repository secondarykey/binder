import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  GetEditor: vi.fn(() => Promise.resolve({})),
  SaveEditor: vi.fn(() => Promise.resolve()),
  GetFont: vi.fn(() => Promise.resolve({})),
  SaveFont: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../bindings/main/window', () => ({
  SelectFile: vi.fn(() => Promise.resolve('')),
}));

import EditorSetting from '../dialogs/EditorSetting';

describe('EditorSetting', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <EditorSetting />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
