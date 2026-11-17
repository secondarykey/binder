import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

// 読み取り専用で開く（_docs/readonly-open.md）の画面側のテスト

const isReadOnlyMock = vi.fn(() => Promise.resolve(false));

vi.mock('../app/FileMenu', () => ({ default: () => <div>FileMenu</div> }));
vi.mock('../components/BinderTree', () => ({ default: () => <div>BinderTree</div> }));
vi.mock('../app/TemplateTree', () => ({ default: () => <div>TemplateTree</div> }));
vi.mock('../../bindings/main/window', () => ({
  OpenSearchWindow: vi.fn(),
}));
vi.mock('../../bindings/binder/api/app', () => ({
  GetConfig: vi.fn(() => Promise.resolve({})),
  IsReadOnly: () => isReadOnlyMock(),
}));

import Menu from '../app/Menu';
import Tree from '../components/Tree';
import EditorArea from '@shared/editor/EditorArea';
import { parseError } from '../error';
import { ReadOnlyContext, useReadOnly, useBinderReadOnly, CodeOpenedElsewhere } from '../readOnly';

beforeEach(() => {
  isReadOnlyMock.mockReset();
  isReadOnlyMock.mockImplementation(() => Promise.resolve(false));
});

describe('parseError の code', () => {
  it('MessageError の code を返す（「別の Binder で開かれている」を見分ける）', () => {
    const env = JSON.stringify({
      message: 'opened elsewhere',
      cause: { body: 'バインダー「D:\\memo」は別の Binder で開かれています', code: 'openedElsewhere' },
      kind: 'RuntimeError',
    });
    const r = parseError(new Error(env));
    expect(r.code).toBe(CodeOpenedElsewhere);
    expect(r.body).toContain('D:\\memo');
  });

  // 今の @wailsio/runtime（3.0.0-alpha2.x）は message に本文、cause に MessageError の中身を入れて投げる
  it('runtime が err.cause に入れた MessageError から code / kind / detail を読む', () => {
    const err = new Error('バインダー「D:\\memo」は別の Binder で開かれています');
    err.name = 'RuntimeError';
    err.cause = { body: 'バインダー「D:\\memo」は別の Binder で開かれています', code: 'openedElsewhere', kind: 'warning', detail: 'DETAIL', cause: 'stack' };
    const r = parseError(err);
    expect(r.code).toBe(CodeOpenedElsewhere);
    expect(r.kind).toBe('warning');
    expect(r.detail).toBe('DETAIL');
    expect(r.body).toContain('D:\\memo');
    expect(r.debug).toContain('stack');
  });

  it('err.cause が MessageError でなければ、これまでどおり message を読む', () => {
    const err = new Error('plain\nmore');
    err.cause = { something: 1 };
    const r = parseError(err);
    expect(r.body).toBe('plain');
    expect(r.detail).toBe('more');
    expect(r.code).toBeUndefined();
  });

  it('code が無ければ undefined', () => {
    const env = JSON.stringify({ message: 'x', cause: { body: 'B' }, kind: 'RuntimeError' });
    expect(parseError(new Error(env)).code).toBeUndefined();
    expect(parseError('plain').code).toBeUndefined();
  });
});

describe('useReadOnly / useBinderReadOnly', () => {
  const wrap = (value) => ({ children }) => (
    <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>
  );

  it('App の配下では ReadOnlyContext の値を使い、Go には聞かない', () => {
    expect(renderHook(() => useReadOnly(), { wrapper: wrap(true) }).result.current).toBe(true);
    expect(renderHook(() => useBinderReadOnly(), { wrapper: wrap(true) }).result.current).toBe(true);
    expect(renderHook(() => useBinderReadOnly(), { wrapper: wrap(false) }).result.current).toBe(false);
    expect(isReadOnlyMock).not.toHaveBeenCalled();
  });

  it('App の配下でなければ（別ウィンドウ）Go に聞く', async () => {
    isReadOnlyMock.mockImplementation(() => Promise.resolve(true));
    const { result } = renderHook(() => useBinderReadOnly());
    await waitFor(() => expect(result.current).toBe(true));
    expect(isReadOnlyMock).toHaveBeenCalled();
    // useReadOnly は App の配下でなければ false
    expect(renderHook(() => useReadOnly()).result.current).toBe(false);
  });

  it('binderPath 指定（バインダーを開かずに見る）は false', () => {
    isReadOnlyMock.mockImplementation(() => Promise.resolve(true));
    expect(renderHook(() => useBinderReadOnly('D:\\memo'), { wrapper: wrap(true) }).result.current).toBe(false);
    expect(isReadOnlyMock).not.toHaveBeenCalled();
  });
});

describe('Menu', () => {
  const renderMenu = (readOnly, props = {}) => {
    const evt = new Event();
    return render(
      <ReadOnlyContext.Provider value={readOnly}>
        <EventContext.Provider value={evt}>
          <MemoryRouter initialEntries={['/editor/note/index']}>
            <Menu {...props} />
          </MemoryRouter>
        </EventContext.Provider>
      </ReadOnlyContext.Provider>
    );
  };

  it('読み取り専用では書き込むための画面を出さず、鍵のボタンから読み直す・開き直すを選べる', async () => {
    const onReload = vi.fn();
    const onReopen = vi.fn();
    renderMenu(true, { onReloadReadOnly: onReload, onReopenWritable: onReopen });

    expect(screen.queryByLabelText('content')).toBeNull(); // テンプレート設定
    expect(screen.getByLabelText('history')).toBeInTheDocument();

    // 鍵のボタンはバインダーのメニューの一番下（履歴 → バインダー設定 → 鍵 の順）
    const lock = screen.getByLabelText('read only');
    const history = screen.getByLabelText('history');
    expect(history.compareDocumentPosition(lock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // 押すとメニューが開く（押しても何も起きない、にしない）
    fireEvent.click(lock);
    let items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(2);
    fireEvent.click(items[0]);
    expect(onReload).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('read only'));
    items = await screen.findAllByRole('menuitem');
    fireEvent.click(items[1]);
    expect(onReopen).toHaveBeenCalledTimes(1);
  });

  it('普段は読み取り専用の表示を出さない', () => {
    renderMenu(false);
    expect(screen.queryByLabelText('read only')).toBeNull();
    expect(screen.getByLabelText('content')).toBeInTheDocument();
  });
});

describe('Tree', () => {
  const data = [{ id: 'index', name: 'Root', type: 'folder', children: [{ id: 'n1', name: 'Child', type: 'note', nodeType: 'note' }] }];

  it('読み取り専用ではドラッグで動かせず、ファイルのドロップ先にもならない', () => {
    const { container } = render(<Tree data={data} expand={['index']} readOnly />);
    const child = screen.getByText('Child').closest('[data-wails-node-id]');
    expect(child.getAttribute('draggable')).toBe('false');
    expect(container.querySelector('[data-file-drop-target]')).toBeNull();
  });

  it('普段はドラッグで動かせる', () => {
    render(<Tree data={data} expand={['index']} />);
    const child = screen.getByText('Child').closest('[data-wails-node-id]');
    expect(child.getAttribute('draggable')).toBe('true');
    expect(child.hasAttribute('data-file-drop-target')).toBe(true);
  });
});

describe('EditorArea', () => {
  it('readOnly では書けない textarea にし、ドロップ先にしない', () => {
    render(<EditorArea text="abc" onChange={() => {}} readOnly dropTarget={{ 'data-file-drop-target': '' }} />);
    const ta = screen.getByRole('textbox');
    expect(ta).toHaveAttribute('readonly');
    expect(ta.hasAttribute('data-file-drop-target')).toBe(false);
  });
});
