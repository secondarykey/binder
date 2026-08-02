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

vi.mock('../components/editor/engines/Marked', () => ({
  default: {
    ensureInit: vi.fn(() => Promise.resolve()),
    getMarkedInfo: vi.fn(() => ({ version: '17.0.5', major: 17, source: 'vendor' })),
  },
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

  // 宣言が無いことも表示する。空欄だと宣言漏れか表示漏れか区別できない
  it('未宣言のバージョン・対応marked を「未宣言」と明示する', async () => {
    listedPlugins.mockResolvedValueOnce([{ name: 'bare', content: '(function(){})();' }]);

    renderSetting();

    // バージョン列と対応marked列の2箇所が「未宣言」になる
    await waitFor(() => expect(screen.getAllByText('plugin.meta.undeclared').length).toBe(2));
    expect(screen.getByText('plugin.compat.undeclaredShort')).toBeTruthy();
  });

  // 対応レンジは「今の marked が何か」と並べて初めて判断できる
  it('現在の marked のバージョンを表示する', async () => {
    renderSetting();
    await waitFor(() => expect(screen.getByText('plugin.meta.currentMarked')).toBeTruthy());
  });

  // アプリ階層は実行時に適用されないため、判定できるのは宣言までだが、
  // 非対応であることは配る前に分かるべき
  it('現在の marked に非対応なプラグインを明示する', async () => {
    listedPlugins.mockResolvedValueOnce([{
      name: 'old',
      content: '/* @plugin-version: 0.9.0 */\n/* @marked: <15 */',
    }]);

    renderSetting();

    await waitFor(() => expect(screen.getByText('plugin.compat.incompatibleShort')).toBeTruthy());
  });
});
