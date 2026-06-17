import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  EditDiagram: vi.fn(() => Promise.resolve()),
  GetDiagram: vi.fn(() => Promise.resolve({})),
  GetHTMLTemplates: vi.fn(() => Promise.resolve([])),
  RemoveDiagram: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../bindings/main/window', () => ({
  OpenSearchWindowWithQuery: vi.fn(),
}));
vi.mock('../app/App', () => ({ copyClipboard: vi.fn() }));

import DiagramMetaDialog from '../dialogs/DiagramMetaDialog';

describe('DiagramMetaDialog', () => {
  it('renders without crashing when open', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <DiagramMetaDialog open={true} id="test-id" onClose={() => {}} />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
