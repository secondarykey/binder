import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  EditLayer: vi.fn(() => Promise.resolve()),
  GetLayer: vi.fn(() => Promise.resolve({})),
  RemoveLayer: vi.fn(() => Promise.resolve()),
}));
vi.mock('../app/App', () => ({ copyClipboard: vi.fn() }));

import LayerMetaDialog from '../dialogs/LayerMetaDialog';

describe('LayerMetaDialog', () => {
  it('renders without crashing when open', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <LayerMetaDialog open={true} id="test-id" onClose={() => {}} />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
