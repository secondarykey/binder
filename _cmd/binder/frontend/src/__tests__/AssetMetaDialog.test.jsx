import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  EditAsset: vi.fn(() => Promise.resolve()),
  GetAsset: vi.fn(() => Promise.resolve({})),
  GetConfig: vi.fn(() => Promise.resolve({})),
  GetPublishSettings: vi.fn(() => Promise.resolve({})),
  RemoveAsset: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../bindings/main/window', () => ({
  OpenSearchWindowWithQuery: vi.fn(),
}));
vi.mock('../clipboard', () => ({ copyClipboard: vi.fn() }));

import { EditAsset, GetAsset, GetConfig, GetPublishSettings } from '../../bindings/binder/api/app';
import AssetMetaDialog from '../dialogs/AssetMetaDialog';

function renderDialog() {
  const evt = new Event();
  evt.register('test', Event.ShowMessage, () => {});
  return render(
    <EventContext.Provider value={evt}>
      <MemoryRouter>
        <AssetMetaDialog open={true} id="test-id" onClose={() => {}} />
      </MemoryRouter>
    </EventContext.Provider>
  );
}

// テストの i18n は未登録のキーをそのまま返す
const ROOT_LABEL = 'asset.rootPublish';

// alias 欄は折りたたまれた「Web公開」の中にあるので開く
function openWebPublish() {
  fireEvent.click(screen.getByText('meta.webPublish'));
}

describe('AssetMetaDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    GetAsset.mockImplementation(() => Promise.resolve({}));
    GetConfig.mockImplementation(() => Promise.resolve({}));
    GetPublishSettings.mockImplementation(() => Promise.resolve({}));
  });

  it('renders without crashing when open', () => {
    const { container } = renderDialog();
    expect(container).toBeTruthy();
  });

  it('toggles the leading "/" of the alias with the site root checkbox', async () => {
    GetAsset.mockImplementation(() => Promise.resolve({ id: 'test-id', name: 'robots', alias: 'robots.txt' }));
    GetConfig.mockImplementation(() => Promise.resolve({ siteUrlGuess: 'https://example.com/' }));
    renderDialog();

    const input = await screen.findByTestId('asset-alias');
    await waitFor(() => expect(input.value).toBe('robots.txt'));
    openWebPublish();
    const checkbox = screen.getByRole('checkbox', { name: ROOT_LABEL });
    expect(checkbox.checked).toBe(false);
    expect(screen.getByTestId('asset-publish-location').textContent).toContain('https://example.com/assets/robots.txt');

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    // 入力欄には "/" を出さず、前置きが /assets/ から / に変わる
    expect(input.value).toBe('robots.txt');
    expect(screen.getByTestId('asset-publish-location').textContent).toContain('https://example.com/robots.txt');

    // 保存ボタンはアイコンだけ（ラベルはツールチップ）
    fireEvent.click(screen.getByTestId('CheckIcon').closest('button'));
    await waitFor(() => expect(EditAsset).toHaveBeenCalled());
    expect(EditAsset.mock.calls[0][0].alias).toBe('/robots.txt');
  });

  it('shows a root alias with the checkbox on', async () => {
    GetAsset.mockImplementation(() => Promise.resolve({ id: 'test-id', name: 'nojekyll', alias: '/.nojekyll' }));
    renderDialog();

    const input = await screen.findByTestId('asset-alias');
    await waitFor(() => expect(input.value).toBe('.nojekyll'));
    openWebPublish();
    expect(screen.getByRole('checkbox', { name: ROOT_LABEL }).checked).toBe(true);
    // サイトの URL が分からなければ docs/ からのパス
    expect(screen.getByTestId('asset-publish-location').textContent).toContain('docs/.nojekyll');
  });

  it('warns that robots.txt has no effect on a project site', async () => {
    GetAsset.mockImplementation(() => Promise.resolve({ id: 'test-id', name: 'robots', alias: '/robots.txt' }));
    GetConfig.mockImplementation(() => Promise.resolve({ siteUrlGuess: 'https://user.github.io/repo/' }));
    renderDialog();

    expect(await screen.findByText('asset.robotsIneffective')).toBeTruthy();
  });

  it('warns when the published data is sent to a subdirectory', async () => {
    GetAsset.mockImplementation(() => Promise.resolve({ id: 'test-id', name: 'nojekyll', alias: '/.nojekyll' }));
    GetPublishSettings.mockImplementation(() => Promise.resolve({ publishOnly: true, publishSubDir: 'en' }));
    renderDialog();

    expect(await screen.findByText('asset.subDirIneffective')).toBeTruthy();
  });
});
