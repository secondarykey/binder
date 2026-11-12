import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router';
import Event, { EventContext } from '../Event';

// 読み込みの順序を確かめるテスト用に、OpenNote だけ差し替える。
// ほかは生成されたバインディングのままで、setup.js の @wailsio/runtime のモック（Call.ByID）を通る
vi.mock('../../bindings/binder/api/app', async (importOriginal) => ({
  ...(await importOriginal()),
  OpenNote: vi.fn(() => Promise.resolve('')),
  GetSnippets: vi.fn(() => Promise.resolve({ markdowns: [], diagrams: [], templates: [] })),
}));

import Component from '../components/editor/Component';
import { OpenNote } from '../../bindings/binder/api/app';

describe('EditorComponent', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.InsertText, () => {});
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter initialEntries={['/note/test-id']}>
          <Component />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });

  // ツールバー・ステータスバーは別の部品（EditorToolbar / PreviewToolbar / ParseStatusBar）。
  // エディタ本体から正しくつながっていることを、ノートのルートで描画して確かめる
  it('ノートを開くと、切り出した部品がつながって描画される', async () => {
    const evt = new Event();
    evt.register('test', Event.InsertText, () => {});
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter initialEntries={['/editor/note/test-id']}>
          <Routes>
            <Route path="/editor/:mode/:id" element={<Component />} />
          </Routes>
        </MemoryRouter>
      </EventContext.Provider>
    );

    // エディタのツールバー（ノートなので書式ボタンが出る）
    expect(container.querySelector('#editorMenu button[aria-label="bold"]')).toBeTruthy();
    expect(container.querySelector('#editorMenu button[aria-label="insert-id"]')).toBeTruthy();
    // プレビューのツールバーとステータスバー
    expect(container.querySelector('#previewMenu button[aria-label="download"]')).toBeTruthy();
    expect(container.querySelector('#parseStatusBar .parseStatusText')).toBeTruthy();
    // スプリッター 2 本
    expect(container.querySelector('#splitter')).toBeTruthy();
    expect(container.querySelector('#treeSplitter')).toBeTruthy();

    // 読み終えるのを待つ（読んでいる間は本文へ挿入しない）
    await act(async () => {});

    // 書式ボタン・表示の切り替えを押しても例外にならない（エディタ本体のハンドラまで届く）
    // jsdom には execCommand が無いので差し替える。呼ばれたことが、本体の挿入処理まで届いた証拠になる
    document.execCommand = vi.fn();
    fireEvent.click(container.querySelector('#editorMenu button[aria-label="bold"]'));
    expect(document.execCommand).toHaveBeenCalledWith('insertText', false, '****');
    fireEvent.click(container.querySelector('#editorMenu button[value="viewer"]'));
    expect(container.querySelector('#dataViewer').classList.contains('hidden')).toBe(true);
    fireEvent.click(container.querySelector('#editorMenu button[value="viewer"]'));
    expect(container.querySelector('#dataViewer').classList.contains('hidden')).toBe(false);
  });

  // ノートからノートへ移るとき、読み終えるまで前の本文を出したままにする（空を挟むと点滅する）
  it('ノートを切り替えても、読み終えるまで本文を空にしない', async () => {
    const pending = {};
    OpenNote.mockImplementation((id) => new Promise((resolve) => { pending[id] = resolve; }));

    let nav;
    const Nav = () => { nav = useNavigate(); return null; };
    const evt = new Event();
    evt.register('test', Event.InsertText, () => {});
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter initialEntries={['/editor/note/a']}>
          <Nav />
          <Routes>
            <Route path="/editor/:mode/:id" element={<Component />} />
          </Routes>
        </MemoryRouter>
      </EventContext.Provider>
    );
    const editor = () => container.querySelector('#editor');

    await act(async () => { pending.a('AAA'); });
    await waitFor(() => expect(editor().value).toBe('AAA'));

    // b を読んでいる間は a の本文のまま。その間の入力は受け付けない（b の ID で保存させない）
    await act(async () => { nav('/editor/note/b'); });
    expect(editor().value).toBe('AAA');
    fireEvent.change(editor(), { target: { value: 'AAAx' } });
    expect(editor().value).toBe('AAA');
    // ツールバーからの挿入も同じ（打鍵と同じく、前の本文に入れたものを b の ID で保存させない）
    document.execCommand = vi.fn();
    fireEvent.click(container.querySelector('#editorMenu button[aria-label="bold"]'));
    expect(document.execCommand).not.toHaveBeenCalled();

    await act(async () => { pending.b('BBB'); });
    await waitFor(() => expect(editor().value).toBe('BBB'));
    // キー操作（Tab）は共有のハンドラが本文を書き換え、本体の state まで届く
    editor().setSelectionRange(0, 0);
    fireEvent.keyDown(editor(), { key: 'Tab' });
    expect(editor().value).toBe('    BBB');
    await act(async () => {});
    expect(editor().value).toBe('    BBB');
    // 読み終えたら挿入できる
    fireEvent.click(container.querySelector('#editorMenu button[aria-label="bold"]'));
    expect(document.execCommand).toHaveBeenCalledWith('insertText', false, '****');

    // 追い越された読み込み（c を開いたあとで届いた b の再読込）は捨てる
    await act(async () => { nav('/editor/note/b2'); });
    await act(async () => { nav('/editor/note/c'); });
    await act(async () => { pending.c('CCC'); });
    await act(async () => { pending.b2('STALE'); });
    expect(editor().value).toBe('CCC');

    OpenNote.mockImplementation(() => Promise.resolve(''));
  });
});
