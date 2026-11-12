import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
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

  // 画像は読み込んだ直後は左上・等倍。位置と倍率が決まるまで見せない
  it('hides the image until it is placed', async () => {
    GetAssetContent.mockResolvedValueOnce({ name: 'a.png', mime: 'image/png', content: 'AAAA' });
    renderViewer();
    const img = await screen.findByAltText('a.png');
    expect(img.style.visibility).toBe('hidden');
    fireEvent.load(img);
    expect(img.style.visibility).toBe('visible');
  });

  describe('switching assets', () => {
    function Go() {
      const nav = useNavigate();
      return <button onClick={() => nav('/editor/asset/next-id')}>go-next</button>;
    }
    function renderSwitchable() {
      const evt = new Event();
      evt.register('test', Event.ShowMessage, () => {});
      return render(
        <EventContext.Provider value={evt}>
          <MemoryRouter initialEntries={['/editor/asset/test-id']}>
            <Go />
            <Routes>
              <Route path="/editor/:mode/:id" element={<AssetViewer />} />
            </Routes>
          </MemoryRouter>
        </EventContext.Provider>
      );
    }
    function deferred() {
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      return { promise, resolve };
    }

    // 画像 → 次のアセット: 次が届くまで前の画像を出したままにする（「Loading...」を挟まない）
    it('keeps the previous image until the next content arrives', async () => {
      GetAssetContent.mockResolvedValueOnce({ name: 'a.png', mime: 'image/png', content: 'AAAA' });
      renderSwitchable();
      await screen.findByAltText('a.png');

      const next = deferred();
      GetAssetContent.mockReturnValueOnce(next.promise);
      fireEvent.click(screen.getByText('go-next'));

      expect(screen.queryByText('Loading...')).toBeNull();
      expect(screen.getByAltText('a.png')).toBeTruthy();
      // 中身と ID が食い違っている間はダウンロードさせない
      expect(screen.getByLabelText('download').disabled).toBe(true);

      next.resolve({ name: 'b.png', mime: 'image/png', content: 'BBBB' });
      await screen.findByAltText('b.png');
      expect(screen.queryByAltText('a.png')).toBeNull();
      expect(screen.getByLabelText('download').disabled).toBe(false);
    });

    // テキストは編集できるので残さない（前の本文への入力が新しい ID で保存されるのを防ぐ）
    it('clears a text asset while the next one is loading', async () => {
      GetAssetContent.mockResolvedValueOnce({ name: 'a.txt', mime: 'text/plain', content: btoa('hello') });
      renderSwitchable();
      await waitFor(() => expect(document.querySelector('#editor')?.value).toBe('hello'));

      GetAssetContent.mockReturnValueOnce(deferred().promise);
      fireEvent.click(screen.getByText('go-next'));

      expect(screen.getByText('Loading...')).toBeTruthy();
      expect(document.querySelector('#editor')).toBeNull();
    });

    // 追い越された読み込みの結果は捨てる
    it('ignores the content of an asset that is no longer open', async () => {
      const first = deferred();
      GetAssetContent.mockReturnValueOnce(first.promise);
      renderSwitchable();

      GetAssetContent.mockResolvedValueOnce({ name: 'b.png', mime: 'image/png', content: 'BBBB' });
      fireEvent.click(screen.getByText('go-next'));
      await screen.findByAltText('b.png');

      first.resolve({ name: 'a.png', mime: 'image/png', content: 'AAAA' });
      await Promise.resolve();
      await Promise.resolve();
      expect(screen.getByAltText('b.png')).toBeTruthy();
      expect(screen.queryByAltText('a.png')).toBeNull();
    });
  });
});
