import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetLayerWithParent: vi.fn(() => Promise.resolve({})),
  GetLayerContent: vi.fn(() => Promise.resolve('{}')),
  SaveLayerContent: vi.fn(() => Promise.resolve()),
  GetAssetContent: vi.fn(() => Promise.resolve('')),
  EnsureAddress: vi.fn(() => Promise.resolve('')),
  Generate: vi.fn(() => Promise.resolve()),
  Unpublish: vi.fn(() => Promise.resolve()),
  Commit: vi.fn(() => Promise.resolve()),
  GetModifiedIds: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../bindings/binder/api/shared/shared', () => ({
  GetFontNames: vi.fn(() => Promise.resolve([])),
}));

import LayerEditor from '../components/LayerEditor';

describe('LayerEditor', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter initialEntries={['/layer/test-id']}>
          <LayerEditor />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
