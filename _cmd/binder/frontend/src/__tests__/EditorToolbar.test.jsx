import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('../../bindings/binder/api/app', () => ({
  GetBinderTree: vi.fn(() => Promise.resolve({
    data: [
      { id: 'self', name: 'Self', type: 'note', updated: '2026-01-01T00:00:00Z', children: [
        { id: 'child', name: 'Child', type: 'diagram', parentId: 'self', updated: '2026-01-01T00:00:00Z' },
      ] },
      { id: 'other', name: 'Other', type: 'note', updated: '2026-03-01T00:00:00Z' },
    ],
  })),
}));

import EditorToolbar from '../components/editor/EditorToolbar';

function setup(overrides = {}) {
  const props = {
    isNote: true, canDownload: true,
    showLineNumbers: true, onToggleLineNumbers: vi.fn(),
    wordWrap: true, onToggleWordWrap: vi.fn(),
    viewer: true, onToggleViewer: vi.fn(),
    text: '# First\n\nbody\n\n## Second\n', cursorLineRef: { current: 5 }, onJumpToLine: vi.fn(),
    snippets: [{ id: 's1', name: 'Snippet 1', body: 'BODY' }], onInsertSnippet: vi.fn(),
    currentId: 'self', onInsertId: vi.fn(), onError: vi.fn(),
    onInsert: vi.fn(),
    alertsAvailable: true, onInsertAlert: vi.fn(),
    onTableEdit: vi.fn(),
    onFontDialog: vi.fn(), onRunEditor: vi.fn(), onDownloadRaw: vi.fn(), onDownloadExpanded: vi.fn(),
    ...overrides,
  };
  const utils = render(<EditorToolbar {...props} />);
  return { props, ...utils };
}

const button = (container, label) => container.querySelector(`button[aria-label="${label}"]`);

describe('EditorToolbar', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('書式ボタンは挟む記号を渡す', () => {
    const { props, container } = setup();
    fireEvent.click(button(container, 'bold'));
    expect(props.onInsert).toHaveBeenLastCalledWith('**', '**');
    fireEvent.click(button(container, 'italic'));
    expect(props.onInsert).toHaveBeenLastCalledWith('*', '*');
    fireEvent.click(button(container, 'strike'));
    expect(props.onInsert).toHaveBeenLastCalledWith('~~', '~~');
    fireEvent.click(button(container, 'table-edit'));
    expect(props.onTableEdit).toHaveBeenCalled();
  });

  it('ノート以外では書式・アウトライン・囲みを出さない', () => {
    const { container } = setup({ isNote: false });
    expect(button(container, 'bold')).toBeNull();
    expect(button(container, 'outline')).toBeNull();
    expect(button(container, 'alerts')).toBeNull();
    expect(button(container, 'table-edit')).toBeNull();
    // ID 挿入とスニペットは種類を問わず出す
    expect(button(container, 'insert-id')).toBeTruthy();
    expect(button(container, 'snippet')).toBeTruthy();
  });

  it('表示の切り替えは 3 つとも呼び出し側へ返す', () => {
    const { props, container } = setup();
    fireEvent.click(container.querySelector('button[value="lineNumbers"]'));
    fireEvent.click(container.querySelector('button[value="wordWrap"]'));
    fireEvent.click(container.querySelector('button[value="viewer"]'));
    expect(props.onToggleLineNumbers).toHaveBeenCalledTimes(1);
    expect(props.onToggleWordWrap).toHaveBeenCalledTimes(1);
    expect(props.onToggleViewer).toHaveBeenCalledTimes(1);
  });

  it('アウトラインは見出しを並べ、カーソルのある見出しを選び、選んだ行を返す', () => {
    const { props, container } = setup();
    fireEvent.click(button(container, 'outline'));
    const first = screen.getByText('First').closest('li');
    const second = screen.getByText('Second').closest('li');
    // カーソルは 5 行目（Second の行）
    expect(first.classList.contains('Mui-selected')).toBe(false);
    expect(second.classList.contains('Mui-selected')).toBe(true);
    fireEvent.click(second);
    expect(props.onJumpToLine).toHaveBeenCalledWith(5);
  });

  it('スニペットを選ぶと本文を返す', () => {
    const { props, container } = setup();
    fireEvent.click(button(container, 'snippet'));
    fireEvent.click(screen.getByText('Snippet 1'));
    expect(props.onInsertSnippet).toHaveBeenCalledWith('BODY');
  });

  it('スニペットは Ctrl+Shift+O でも開く', () => {
    setup();
    expect(screen.queryByText('Snippet 1')).toBeNull();
    fireEvent.keyDown(document, { key: 'O', ctrlKey: true, shiftKey: true });
    expect(screen.getByText('Snippet 1')).toBeTruthy();
  });

  it('スニペットが無ければボタンを出さない', () => {
    const { container } = setup({ snippets: [] });
    expect(button(container, 'snippet')).toBeNull();
  });

  it('ID 挿入は子を先頭に並べ、自分自身は出さず、選んだものを返す', async () => {
    const { props, container } = setup();
    fireEvent.click(button(container, 'insert-id'));
    const child = await screen.findByText('Child');
    expect(screen.queryByText('Self')).toBeNull();
    const names = Array.from(child.closest('ul').querySelectorAll('li')).map((li) => li.textContent);
    expect(names).toEqual(['Child', 'Other']);
    fireEvent.click(child);
    expect(props.onInsertId).toHaveBeenCalledWith(expect.objectContaining({ id: 'child', type: 'diagram' }));
  });

  it('ID 挿入は Ctrl+T でも開く', async () => {
    setup();
    fireEvent.keyDown(document, { key: 't', ctrlKey: true });
    expect(await screen.findByText('Other')).toBeTruthy();
  });

  it('囲みを選ぶと種類を返す', () => {
    const { props, container } = setup();
    fireEvent.click(button(container, 'alerts'));
    fireEvent.click(screen.getByText(/NOTE/));
    expect(props.onInsertAlert).toHaveBeenCalledWith('NOTE');
  });

  it('その他メニューからフォント・外部エディタ・ダウンロードを呼べる', async () => {
    const { props, container } = setup();
    const more = container.querySelector('.buttonBarRight button.editorBtn');

    fireEvent.click(more);
    fireEvent.click(screen.getByText('editor.fontSetting'));
    expect(props.onFontDialog).toHaveBeenCalled();

    fireEvent.click(more);
    fireEvent.click(screen.getByText('editor.openExternalEditor'));
    expect(props.onRunEditor).toHaveBeenCalled();

    fireEvent.click(more);
    fireEvent.click(screen.getByText('tree.download'));
    fireEvent.click(await screen.findByText('tree.downloadText'));
    expect(props.onDownloadRaw).toHaveBeenCalled();
    // 選んだらメニューは閉じる
    await waitFor(() => expect(screen.queryByText('tree.downloadText')).toBeNull());
  });

  it('ダウンロードできない種類では、その他メニューにダウンロードを出さない', () => {
    const { container } = setup({ isNote: false, canDownload: false });
    fireEvent.click(container.querySelector('.buttonBarRight button.editorBtn'));
    expect(screen.getByText('editor.fontSetting')).toBeTruthy();
    expect(screen.queryByText('tree.download')).toBeNull();
  });
});
