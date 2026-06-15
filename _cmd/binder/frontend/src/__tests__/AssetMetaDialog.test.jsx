import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  EditAsset: vi.fn(() => Promise.resolve()),
  GetAsset: vi.fn(() => Promise.resolve({})),
  RemoveAsset: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../bindings/main/window', () => ({
  OpenSearchWindowWithQuery: vi.fn(),
}));
vi.mock('../app/App', () => ({ copyClipboard: vi.fn() }));

import AssetMetaDialog from '../dialogs/AssetMetaDialog';

describe('AssetMetaDialog', () => {
  it('renders without crashing when open', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <AssetMetaDialog open={true} id="test-id" onClose={() => {}} />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
