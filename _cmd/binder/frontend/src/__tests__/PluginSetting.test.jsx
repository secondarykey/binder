import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

const listedPlugins = vi.fn(() => Promise.resolve([]));

vi.mock('../../bindings/binder/api/app', () => ({
  GetPlugins: vi.fn(() => listedPlugins()),
  SavePlugin: vi.fn(() => Promise.resolve()),
  RemovePlugin: vi.fn(() => Promise.resolve()),
  RenamePlugin: vi.fn(() => Promise.resolve()),
  ListAppPlugins: vi.fn(() => Promise.resolve([])),
  InstallAppPlugin: vi.fn(() => Promise.resolve()),
  SetPluginVerifiedMajor: vi.fn(() => Promise.resolve()),
  GetPluginVerifiedMajors: vi.fn(() => Promise.resolve({})),
}));

const pluginStatus = vi.fn(() => ({}));

vi.mock('../components/editor/engines/Marked', () => ({
  default: {
    ensureInit: vi.fn(() => Promise.resolve()),
    getMarkedInfo: vi.fn(() => ({ version: '14.1.4', major: 14, source: 'vendor' })),
    getPluginStatus: vi.fn(() => pluginStatus()),
  },
}));

import PluginSetting from '../dialogs/PluginSetting';

function renderSetting() {
  const evt = new Event();
  evt.register('test', Event.ShowMessage, () => {});
  const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
  return render(
    <EventContext.Provider value={evt}>
      <DialogErrorContext.Provider value={ctx}>
        <PluginSetting engine="marked" />
      </DialogErrorContext.Provider>
    </EventContext.Provider>
  );
}

describe('PluginSetting', () => {
  it('renders without crashing', () => {
    const { container } = renderSetting();
    expect(container).toBeTruthy();
  });

  // 宣言だけでなく「実際に動いたか」を出さないと、設定画面が緑のまま
  // プラグインが死んでいる状態に気付けない
  it('実行時エラーになったプラグインを一覧上で明示する', async () => {
    listedPlugins.mockResolvedValueOnce([{ name: 'boom', content: '/* @marked: >=14 <19 */' }]);
    pluginStatus.mockReturnValueOnce({
      boom: { status: 'compatible', meta: { marked: '>=14 <19' }, applied: true, runtimeError: 'boom' },
    });

    renderSetting();

    await waitFor(() => expect(screen.getByText('boom')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('plugin.compat.runtimeErrorShort')).toBeTruthy());
  });

  it('互換上は問題ないのに適用されなかったプラグインを明示する', async () => {
    listedPlugins.mockResolvedValueOnce([{ name: 'empty', content: '/* @marked: >=14 <19 */' }]);
    pluginStatus.mockReturnValueOnce({
      empty: { status: 'compatible', meta: { marked: '>=14 <19' }, applied: false },
    });

    renderSetting();

    await waitFor(() => expect(screen.getByText('plugin.compat.notAppliedShort')).toBeTruthy());
  });
});
