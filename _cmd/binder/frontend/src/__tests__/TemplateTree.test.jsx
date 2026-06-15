import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetTemplateTree: vi.fn(() => Promise.resolve([])),
  UpdateTemplateSeqs: vi.fn(() => Promise.resolve()),
  RemoveTemplate: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../bindings/main/window', () => ({
  OpenHistoryWindow: vi.fn(),
}));
vi.mock('../dialogs/TemplateMetaDialog', () => ({ default: () => null }));

import TemplateTree from '../app/TemplateTree';

describe('TemplateTree', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ReloadTree, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <TemplateTree />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
