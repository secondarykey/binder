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

    // ファイル名は primary と表示名の列の2箇所に出る（@plugin-name 未宣言のため）
    await waitFor(() => expect(screen.getAllByText('boom').length).toBe(2));
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

  // どのプラグインがどの marked 向けなのかを一覧で比較できる必要がある
  // （従来は title 属性のツールチップにしか出ていなかった）
  it('プラグインのバージョンと対応marked を一覧に表示する', async () => {
    listedPlugins.mockResolvedValueOnce([{
      name: 'kbd',
      content: '/* @plugin-name: Keyboard Tag */\n/* @plugin-version: 1.2.0 */\n/* @marked: >=14 <19 */',
    }]);

    renderSetting();

    await waitFor(() => expect(screen.getByText('Keyboard Tag')).toBeTruthy());
    expect(screen.getByText('v1.2.0')).toBeTruthy();
    expect(screen.getByText('marked >=14 <19')).toBeTruthy();
  });

  // 状態列は正常系も含めて常に埋める（空欄だと表示漏れと区別が付かない）
  it('正常なプラグインにも状態ラベルを出す', async () => {
    listedPlugins.mockResolvedValueOnce([{ name: 'kbd', content: '/* @marked: >=14 <19 */' }]);
    pluginStatus.mockReturnValueOnce({ kbd: { applied: true } });

    renderSetting();

    await waitFor(() => expect(screen.getByText('plugin.compat.compatibleShort')).toBeTruthy());
  });

  // @plugin-name が無いプラグインでも表示名の列は埋まる（名前はファイル名由来）
  it('@plugin-name が無ければファイル名を表示名として出す', async () => {
    listedPlugins.mockResolvedValueOnce([{
      name: 'kbd',
      content: '/* @plugin-version: 1.0.0 */\n/* @marked: >=14 <19 */',
    }]);

    renderSetting();

    // primary（ファイル名）と表示名の列で2箇所に出る
    await waitFor(() => expect(screen.getAllByText('kbd').length).toBe(2));
    expect(screen.getByText('v1.0.0')).toBeTruthy();
  });

  it('現在の marked のバージョンを表示する', async () => {
    renderSetting();
    await waitFor(() => expect(screen.getByText('plugin.meta.currentMarked')).toBeTruthy());
  });
});
