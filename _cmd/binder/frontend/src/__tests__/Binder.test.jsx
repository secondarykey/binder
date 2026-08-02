import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

const config = vi.fn(() => Promise.resolve({}));

vi.mock('../../bindings/binder/api/app', () => ({
  GetConfig: vi.fn(() => config()),
  EditConfig: vi.fn(() => Promise.resolve()),
  GetUserInfo: vi.fn(() => Promise.resolve({})),
  EditUserInfo: vi.fn(() => Promise.resolve()),
  GetAllowedCDNs: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../bindings/main/window', () => ({
  SelectFileContent: vi.fn(() => Promise.resolve('')),
}));
vi.mock('../dialogs/PluginSetting', () => ({ default: () => <div>PluginSetting</div> }));
vi.mock('../dialogs/RootFileSetting', () => ({ default: () => <div>RootFileSetting</div> }));

import Binder from '../dialogs/Binder';
import MarkedScript from '../components/editor/engines/Marked';

function renderBinder() {
  const evt = new Event();
  evt.register('test', Event.ShowMessage, () => {});
  const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
  return render(
    <EventContext.Provider value={evt}>
      <DialogErrorContext.Provider value={ctx}>
        <Binder isModal />
      </DialogErrorContext.Provider>
    </EventContext.Provider>
  );
}

// スクリプトタブへ切り替える（バージョン表示はここにある）
async function openScriptSection() {
  const nav = await screen.findByText('binder.script');
  fireEvent.click(nav);
}

describe('Binder', () => {
  it('renders without crashing', () => {
    const { container } = renderBinder();
    expect(container).toBeTruthy();
  });

  // 表示は URL の記載ではなく実際に動いている版に従う必要がある。
  // 読み込みに失敗してベンダー版で動いているのに URL 由来の版を出すと、
  // バージョン固定できているように見えてしまう。
  it('CDN 指定が読み込めずベンダー版で動作中なら失敗として表示する', async () => {
    const url = 'https://cdn.jsdelivr.net/npm/marked@14.1.4/lib/marked.esm.js';
    config.mockResolvedValueOnce({ markedUrl: url });
    vi.spyOn(MarkedScript, 'ensureInit').mockResolvedValue(undefined);
    vi.spyOn(MarkedScript, 'getMarkedInfo').mockReturnValue({
      version: '18.0.7', major: 18, source: 'vendor',
    });

    renderBinder();
    await openScriptSection();

    await waitFor(() => expect(screen.getByText('binder.versionCdnFallback')).toBeTruthy());
    // URL に書かれた版を「動いている版」として出してはいけない
    expect(screen.queryByText('binder.versionCdn')).toBeNull();
    expect(screen.queryByText('binder.versionCdnDetected')).toBeNull();

    vi.restoreAllMocks();
  });

  it('CDN で実際に動いていればその版を表示する', async () => {
    const url = 'https://cdn.jsdelivr.net/npm/marked@18.0.7/lib/marked.esm.js';
    config.mockResolvedValueOnce({ markedUrl: url });
    vi.spyOn(MarkedScript, 'ensureInit').mockResolvedValue(undefined);
    vi.spyOn(MarkedScript, 'getMarkedInfo').mockReturnValue({
      version: '18.0.7', major: 18, source: 'cdn',
    });

    renderBinder();
    await openScriptSection();

    await waitFor(() => expect(screen.getByText('binder.versionCdn')).toBeTruthy());

    vi.restoreAllMocks();
  });
});
