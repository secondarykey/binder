import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  EditTemplate: vi.fn(() => Promise.resolve()),
  GetTemplate: vi.fn(() => Promise.resolve({})),
  RemoveTemplate: vi.fn(() => Promise.resolve()),
}));
vi.mock('../app/App', () => ({ copyClipboard: vi.fn() }));

import TemplateMetaDialog from '../dialogs/TemplateMetaDialog';

describe('TemplateMetaDialog', () => {
  it('renders without crashing when open', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <TemplateMetaDialog open={true} id="test-id" type="layout" onClose={() => {}} />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
