import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

const listedPlugins = vi.fn(() => Promise.resolve([]));

vi.mock('../../bindings/binder/api/app', () => ({
  ListAppPlugins: vi.fn(() => listedPlugins()),
  SaveAppPlugin: vi.fn(() => Promise.resolve()),
  RemoveAppPlugin: vi.fn(() => Promise.resolve()),
  RenameAppPlugin: vi.fn(() => Promise.resolve()),
}));

import AppPluginSetting from '../dialogs/AppPluginSetting';

function renderSetting() {
  const evt = new Event();
  evt.register('test', Event.ShowMessage, () => {});
  const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
  return render(
    <EventContext.Provider value={evt}>
      <DialogErrorContext.Provider value={ctx}>
        <AppPluginSetting engine="marked" />
      </DialogErrorContext.Provider>
    </EventContext.Provider>
  );
}

describe('AppPluginSetting', () => {
  it('renders without crashing', () => {
    const { container } = renderSetting();
    expect(container).toBeTruthy();
  });

  // アプリ階層はバインダーへ配る元なので、配る前に「何のバージョンで
  // どの marked 向けか」が一覧で分かる必要がある
  it('プラグインのバージョンと対応marked を一覧に表示する', async () => {
    listedPlugins.mockResolvedValueOnce([{
      name: 'kbd',
      content: '/* @plugin-name: Keyboard Tag */\n/* @plugin-version: 1.2.0 */\n/* @marked: >=14 <19 */',
    }]);

    renderSetting();

    await waitFor(() => expect(screen.getByText('kbd')).toBeTruthy());
    expect(screen.getByText('Keyboard Tag')).toBeTruthy();
    expect(screen.getByText('v1.2.0')).toBeTruthy();
    expect(screen.getByText('marked >=14 <19')).toBeTruthy();
  });

  // 宣言が無い列も埋める。空欄だと宣言漏れか表示漏れか区別できない
  it('未宣言のバージョン・対応marked を "-" で埋める', async () => {
    listedPlugins.mockResolvedValueOnce([{ name: 'bare', content: '(function(){})();' }]);

    renderSetting();

    // バージョン列と対応marked列の2箇所が "-" になる
    await waitFor(() => expect(screen.getAllByText('-').length).toBe(2));
  });

  // marked のバージョンはバインダーごとの設定（binder.json の markedUrl）で決まるため、
  // アプリ設定で出せるのは「今たまたま開いているバインダーの値」にしかならない。
  // 突き合わせはインストール先（PluginSetting）が行う。
  it('現在の marked との突き合わせは行わない', async () => {
    listedPlugins.mockResolvedValueOnce([{
      name: 'old',
      content: '/* @plugin-version: 0.9.0 */\n/* @marked: <15 */',
    }]);

    const { container } = renderSetting();

    await waitFor(() => expect(screen.getByText('v0.9.0')).toBeTruthy());
    // 宣言（対応marked）は出すが、互換状態のドット・ツールチップは出さない
    expect(screen.getByText('marked <15')).toBeTruthy();
    expect(screen.queryByText('plugin.meta.currentMarked')).toBeNull();
    expect(container.querySelector('[title^="plugin.compat."]')).toBeNull();
  });
});
