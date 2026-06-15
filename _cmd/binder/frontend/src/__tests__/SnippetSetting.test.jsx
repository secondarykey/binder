import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  GetSnippets: vi.fn(() => Promise.resolve({ markdowns: [], diagrams: [], templates: [] })),
  SaveSnippets: vi.fn(() => Promise.resolve()),
}));

import SnippetSetting from '../dialogs/SnippetSetting';

describe('SnippetSetting', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <SnippetSetting />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
