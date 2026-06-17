import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetAsset: vi.fn(() => Promise.resolve({})),
  GetAssetContent: vi.fn(() => Promise.resolve('')),
  EditAsset: vi.fn(() => Promise.resolve()),
  Generate: vi.fn(() => Promise.resolve()),
  Unpublish: vi.fn(() => Promise.resolve()),
  Commit: vi.fn(() => Promise.resolve()),
  MigrateAssetToNote: vi.fn(() => Promise.resolve()),
  SetAssetAsMetaImage: vi.fn(() => Promise.resolve()),
  GetFont: vi.fn(() => Promise.resolve({})),
  SaveAssetContent: vi.fn(() => Promise.resolve()),
  GetModifiedIds: vi.fn(() => Promise.resolve([])),
  EnsureAddress: vi.fn(() => Promise.resolve('')),
  ParseAsset: vi.fn(() => Promise.resolve('')),
  DetectAssetMime: vi.fn(() => Promise.resolve('')),
}));
vi.mock('../../bindings/main/window', () => ({
  SelectFile: vi.fn(() => Promise.resolve('')),
}));

import AssetViewer from '../components/AssetViewer';

describe('AssetViewer', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter initialEntries={['/asset/test-id']}>
          <AssetViewer />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
