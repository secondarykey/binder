import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import Event, { EventContext } from '../Event';

const { GetAssetContent, GetAsset, EditAsset, DetectAssetMime } = vi.hoisted(() => ({
  GetAssetContent: vi.fn(() => Promise.resolve('')),
  GetAsset: vi.fn(() => Promise.resolve({})),
  EditAsset: vi.fn(() => Promise.resolve()),
  DetectAssetMime: vi.fn(() => Promise.resolve('')),
}));

vi.mock('../../bindings/binder/api/app', () => ({
  GetAsset,
  GetAssetContent,
  EditAsset,
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
  DetectAssetMime,
}));
vi.mock('../../bindings/main/window', () => ({
  SelectFile: vi.fn(() => Promise.resolve('')),
}));

import AssetViewer from '../components/AssetViewer';

function renderViewer() {
  const evt = new Event();
  evt.register('test', Event.ShowMessage, () => {});
  return render(
    <EventContext.Provider value={evt}>
      <MemoryRouter initialEntries={['/editor/asset/test-id']}>
        <Routes>
          <Route path="/editor/:mode/:id" element={<AssetViewer />} />
        </Routes>
      </MemoryRouter>
    </EventContext.Provider>
  );
}

describe('AssetViewer', () => {
  it('renders without crashing', () => {
    const { container } = renderViewer();
    expect(container).toBeTruthy();
  });

  // MIME に charset 等のパラメータが付いていても表示切り替えができること
  it.each([
    'text/html',
    'text/html; charset=utf-8',
    'image/svg+xml; charset=utf-8',
  ])('shows the source/preview toggle for %s', async (mime) => {
    GetAssetContent.mockResolvedValueOnce({ name: 'a.html', mime, content: btoa('<p>hi</p>') });
    renderViewer();
    await waitFor(() => {
      expect(screen.getByLabelText('toggle preview')).toBeTruthy();
    });
  });

  // MIME修正ダイアログで選び直さずに保存した場合、設定済みの値（パラメータ含む）を書き換えない
  it('keeps the stored mime as-is when the fix dialog is saved untouched', async () => {
    const stored = 'application/pdf; charset=utf-8';
    GetAsset.mockResolvedValueOnce({ id: 'test-id', name: 'a.pdf', mime: stored });
    GetAssetContent.mockResolvedValueOnce({ name: 'a.pdf', mime: stored, content: btoa('pdf') });
    // 推定に失敗した場合は提案が入らないので、現在値がそのまま残る
    DetectAssetMime.mockRejectedValueOnce(new Error('detect failed'));

    renderViewer();
    fireEvent.click(await screen.findByText('assetViewer.fixMimeType'));
    // ActionButton はラベルを Tooltip に持つアイコンボタン（span > button）
    const save = await screen.findByLabelText('common.save');
    fireEvent.click(save.querySelector('button'));

    await waitFor(() => {
      expect(EditAsset).toHaveBeenCalledWith(
        expect.objectContaining({ mime: stored }),
        ''
      );
    });
  });
});
