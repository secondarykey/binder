import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../../bindings/binder/api/app', () => ({
  GetNote: vi.fn(() => Promise.resolve({})),
  ParseNote: vi.fn(() => Promise.resolve('')),
  OpenNote: vi.fn(() => Promise.resolve('')),
  GetDiagram: vi.fn(() => Promise.resolve({})),
  ParseDiagram: vi.fn(() => Promise.resolve('')),
  OpenDiagram: vi.fn(() => Promise.resolve('')),
  SaveContent: vi.fn(() => Promise.resolve()),
  GetConfig: vi.fn(() => Promise.resolve({})),
  GetFont: vi.fn(() => Promise.resolve({})),
  Generate: vi.fn(() => Promise.resolve()),
  Unpublish: vi.fn(() => Promise.resolve()),
  Commit: vi.fn(() => Promise.resolve()),
  GetModifiedIds: vi.fn(() => Promise.resolve([])),
  EnsureAddress: vi.fn(() => Promise.resolve('')),
  GetSnippets: vi.fn(() => Promise.resolve({ markdowns: [], diagrams: [], templates: [] })),
  GetStructure: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../../bindings/main/window', () => ({
  OpenHistoryWindow: vi.fn(),
  OpenPreviewWindow: vi.fn(),
  OpenSearchWindowWithQuery: vi.fn(),
}));

import Component from '../components/editor/Component';

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
  it('ノートを開くと、切り出した部品がつながって描画される', () => {
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
});
