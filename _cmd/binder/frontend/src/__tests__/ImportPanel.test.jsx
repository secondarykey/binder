import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  GetUserInfo: vi.fn(() => Promise.resolve({})),
  RemoteList: vi.fn(() => Promise.resolve([])),
  GetModifiedIds: vi.fn(() => Promise.resolve([])),
  CurrentBranch: vi.fn(() => Promise.resolve('')),
  ListBranches: vi.fn(() => Promise.resolve([])),
  ListRemoteBranches: vi.fn(() => Promise.resolve([])),
  MergeFromRemote: vi.fn(() => Promise.resolve({})),
  MergeFromLocal: vi.fn(() => Promise.resolve({})),
  ApplyMergeResolution: vi.fn(() => Promise.resolve()),
  GetHistoryPatch: vi.fn(() => Promise.resolve('')),
  AddRemote: vi.fn(() => Promise.resolve()),
  EditRemote: vi.fn(() => Promise.resolve()),
  DeleteRemote: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../bindings/main/window', () => ({
  SelectFileContent: vi.fn(() => Promise.resolve('')),
}));

import ImportPanel from '../dialogs/ImportPanel';
import { CurrentBranch, ListBranches } from '../../bindings/binder/api/app';

describe('ImportPanel', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    const { container } = render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <ImportPanel />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });

  // 取込元（上）→ 反映先（下）の流れで、反映先は現在のブランチを表示のみで出す
  it('ブランチから取込では取込元の下に現在のブランチを反映先として表示する', async () => {
    CurrentBranch.mockResolvedValueOnce('main');
    ListBranches.mockResolvedValueOnce(['main', 'feature-x']);

    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
    render(
      <EventContext.Provider value={evt}>
        <DialogErrorContext.Provider value={ctx}>
          <ImportPanel />
        </DialogErrorContext.Provider>
      </EventContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /share.modeLocal/ }));

    const target = await screen.findByTestId('import-target');
    expect(target.textContent).toContain('main');
    // 反映先は入力欄ではない
    expect(target.querySelector('input')).toBeNull();
    // 取込元・反映先がそろうと確認文が出る
    expect(await screen.findByTestId('import-summary')).toBeTruthy();
  });
});
