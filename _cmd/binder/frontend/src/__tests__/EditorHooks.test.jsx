import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Component.jsx から切り出したフックのテスト

vi.mock('../../bindings/binder/api/app', async (importOriginal) => ({
  ...(await importOriginal()),
  GetHTMLTemplates: vi.fn(),
  GetBinderTree: vi.fn(),
  ParseNote: vi.fn(),
  ParseDiagram: vi.fn(),
  CreateNoteHTML: vi.fn(),
  Unpublish: vi.fn(() => Promise.resolve()),
  EnsureAddress: vi.fn(() => Promise.resolve('http://localhost:1234')),
}));
vi.mock('../components/editor/download', () => ({
  downloadBlob: vi.fn(),
  triggerTextDownload: vi.fn(),
}));
vi.mock('../components/editor/engines/Marked.jsx', () => ({
  default: {
    parse: vi.fn((s) => Promise.resolve(`<p>${s}</p>`)),
    parseWithSourceLines: vi.fn((s) => Promise.resolve(`<p data-src-line="1">${s}</p>`)),
    getPluginStatus: vi.fn(() => []),
    getWarnings: vi.fn(() => []),
  },
}));

import { GetHTMLTemplates, GetBinderTree, ParseNote, ParseDiagram, CreateNoteHTML, Unpublish } from '../../bindings/binder/api/app';
import { Browser } from '@wailsio/runtime';
import { downloadBlob, triggerTextDownload } from '../components/editor/download';
import { useTemplatePreviewTargets } from '../components/editor/useTemplatePreviewTargets';
import { useEditorDownloads } from '../components/editor/useEditorDownloads';
import { useEditorPreview } from '../components/editor/useEditorPreview';
import { useEditorPublish } from '../components/editor/useEditorPublish.jsx';
import { Mode } from '../mode';
import { Mode as AppMode } from '../app/App.jsx';

const t = (key) => key;

describe('mode', () => {
  it('App.jsx からも同じものが取れる', () => {
    expect(AppMode).toBe(Mode);
    expect(Mode.note).toBe('note');
  });
});

describe('useTemplatePreviewTargets', () => {
  const tree = { data: [
    { id: 'n1', name: 'Note 1', type: 'note', children: [
      { id: 'd1', name: 'Diagram 1', type: 'diagram', children: [] },
      { id: 'd2', name: 'Diagram 2', type: 'diagram', children: [] },
      { id: 'n2', name: 'Note 2', type: 'note' },
    ] },
  ] };
  const templates = {
    layouts: [{ id: 'l1', name: 'Layout 1' }, { id: 'l2', name: 'Layout 2' }],
    contents: [{ id: 'c1', name: 'Content 1' }, { id: 'c2', name: 'Content 2' }],
  };

  beforeEach(() => {
    GetBinderTree.mockImplementation(() => Promise.resolve(tree));
    GetHTMLTemplates.mockImplementation(() => Promise.resolve(templates));
  });

  it('読み込むと先頭を選び、選び直したものは次に開いたときに戻す', async () => {
    const first = renderHook(() => useTemplatePreviewTargets({ onError: vi.fn() }));
    act(() => first.result.current.load());
    await waitFor(() => expect(first.result.current.noteId).toBe('n1'));
    expect(first.result.current.diagramId).toBe('d1');
    expect(first.result.current.notes.map((n) => n.id)).toEqual(['n1', 'n2']);

    // 「もう一方のテンプレート」は、layout を編集中なら content、それ以外なら layout
    await waitFor(() => expect(first.result.current.layouts).toHaveLength(2));
    expect(first.result.current.otherTemplates('layout')).toBe(first.result.current.contents);
    expect(first.result.current.otherTemplates('content')).toBe(first.result.current.layouts);
    act(() => first.result.current.selectDefaultOtherTemplate('layout'));
    expect(first.result.current.otherTemplateId).toBe('c1');

    act(() => {
      first.result.current.changeNote('n2');
      first.result.current.changeDiagram('d2');
      first.result.current.changeOtherTemplate('c2');
    });
    expect(first.result.current.noteId).toBe('n2');
    first.unmount();

    // エディタを開き直しても、前に選んだものを選ぶ
    const second = renderHook(() => useTemplatePreviewTargets({ onError: vi.fn() }));
    act(() => second.result.current.load());
    await waitFor(() => expect(second.result.current.noteId).toBe('n2'));
    expect(second.result.current.diagramId).toBe('d2');
    await waitFor(() => expect(second.result.current.contents).toHaveLength(2));
    act(() => second.result.current.selectDefaultOtherTemplate('layout'));
    expect(second.result.current.otherTemplateId).toBe('c2');
    // 一覧に無いもの（種類が違う側）は先頭に戻る
    act(() => second.result.current.selectDefaultOtherTemplate('content'));
    expect(second.result.current.otherTemplateId).toBe('l1');

    act(() => second.result.current.clearOtherTemplate());
    expect(second.result.current.otherTemplateId).toBe('');
  });

  it('読み込みに失敗したら onError へ渡す', async () => {
    GetBinderTree.mockImplementation(() => Promise.reject('NG'));
    const onError = vi.fn();
    const { result } = renderHook(() => useTemplatePreviewTargets({ onError }));
    act(() => result.current.load());
    await waitFor(() => expect(onError).toHaveBeenCalledWith('NG'));
  });
});

describe('useEditorDownloads', () => {
  beforeEach(() => {
    downloadBlob.mockClear();
    triggerTextDownload.mockClear();
  });

  it('ノートは .md / .html、図は .mmd で保存する', async () => {
    const onError = vi.fn();
    const note = useEditorDownloads({ mode: Mode.note, id: 'n1', name: 'メモ', text: '# a', html: '<h1>a</h1>', onError });
    note.downloadRaw();
    expect(triggerTextDownload).toHaveBeenCalledWith('# a', 'メモ.md');
    await note.download();
    expect(downloadBlob).toHaveBeenCalledWith('<h1>a</h1>', 'text/html', 'メモ.html');

    const diagram = useEditorDownloads({ mode: Mode.diagram, id: 'd1', name: '図', text: 'graph TD', html: '', onError });
    diagram.downloadRaw();
    expect(triggerTextDownload).toHaveBeenCalledWith('graph TD', '図.mmd');
  });

  it('展開済みは、テンプレート関数を展開した結果を保存する。失敗したら保存しない', async () => {
    const onError = vi.fn();
    const note = useEditorDownloads({ mode: Mode.note, id: 'n1', name: 'メモ', text: '{{x}}', html: '', onError });

    ParseNote.mockImplementation(() => Promise.resolve({ html: '展開済み' }));
    await note.downloadExpanded();
    expect(ParseNote).toHaveBeenCalledWith('n1', false, '{{x}}');
    expect(triggerTextDownload).toHaveBeenCalledWith('展開済み', 'メモ.md');

    triggerTextDownload.mockClear();
    ParseNote.mockImplementation(() => Promise.resolve({ error: 'NG' }));
    await note.downloadExpanded();
    expect(onError).toHaveBeenCalledWith('NG');
    expect(triggerTextDownload).not.toHaveBeenCalled();
  });
});

describe('useEditorPreview', () => {
  const base = (over) => ({
    mode: Mode.note, id: 'n1', name: 'メモ', text: 'hello',
    idRef: { current: 'n1' }, cursorLineRef: { current: 3 },
    setCursorLine: vi.fn(), setAlertsAvailable: vi.fn(),
    styleTemplateId: '', templateType: '',
    previewNoteId: '', previewOtherTemplateId: '', previewDiagramId: '',
    evt: { showErrorMessage: vi.fn() }, t,
    ...over,
  });

  beforeEach(() => {
    ParseNote.mockClear();
    ParseNote.mockImplementation((id, local, txt) => Promise.resolve({ html: txt, warnings: [] }));
    CreateNoteHTML.mockImplementation((id, local, html) => Promise.resolve({ html: `<body>${html}</body>`, warnings: [] }));
  });

  it('本文が空なら、エラーにしてプレビューを空にする', async () => {
    const { result } = renderHook(() => useEditorPreview(base({ text: '' })));
    await act(async () => { await result.current.parseText(); });
    expect(result.current.parseStatus).toMatchObject({ status: 'error', errorLine: 1 });
    expect(result.current.html).toBe('');
    expect(ParseNote).not.toHaveBeenCalled();
  });

  it('ノートは HTML を作り、カーソル行を HTML と同時に渡す', async () => {
    const p = base();
    const { result } = renderHook(() => useEditorPreview(p));
    act(() => { result.current.parseText(); });
    await waitFor(() => expect(result.current.parseStatus.status).toBe('success'));
    expect(result.current.html).toBe('<body><p data-src-line="1">hello</p></body>');
    expect(result.current.htmlRef.current).toBe(result.current.html);
    expect(p.setCursorLine).toHaveBeenCalledWith(3);
  });

  it('変換のエラーと警告をステータスにする', async () => {
    CreateNoteHTML.mockImplementation(() => Promise.resolve({ html: '<body></body>', warnings: ['w1'] }));
    const warn = renderHook(() => useEditorPreview(base()));
    act(() => { warn.result.current.parseText(); });
    await waitFor(() => expect(warn.result.current.parseStatus).toMatchObject({ status: 'warning', warnings: ['w1'] }));

    ParseNote.mockImplementation(() => Promise.resolve({ error: 'bad template', errorLine: 2 }));
    const err = renderHook(() => useEditorPreview(base()));
    act(() => { err.result.current.parseText(); });
    await waitFor(() => expect(err.result.current.parseStatus).toMatchObject({ status: 'error', err: 'bad template', errorLine: 2 }));
  });

  it('変換している間に別のものを開いていたら、結果を捨てる', async () => {
    const idRef = { current: 'n1' };
    let finish;
    CreateNoteHTML.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useEditorPreview(base({ idRef })));
    act(() => { result.current.parseText(); });
    await waitFor(() => expect(finish).toBeTruthy());

    idRef.current = 'n2';
    await act(async () => { finish({ html: 'STALE', warnings: [] }); });
    expect(result.current.html).toBe('');
  });

  it('衝突の印が残っているノートは、marked を通さず衝突の表示にする', async () => {
    const text = '<<<<<<< ours\na\n=======\nb\n>>>>>>> theirs\n';
    const { result } = renderHook(() => useEditorPreview(base({ text })));
    act(() => { result.current.parseText(); });
    await waitFor(() => expect(result.current.parseStatus.status).toBe('warning'));
    expect(ParseNote).not.toHaveBeenCalled();
    expect(result.current.html).not.toBe('');
  });

  it('図の変換に失敗したら、エラー行つきのエラーにする', async () => {
    ParseDiagram.mockImplementation(() => Promise.resolve({ error: 'bad', errorLine: 4 }));
    const { result } = renderHook(() => useEditorPreview(base({ mode: Mode.diagram, id: 'd1', idRef: { current: 'd1' }, text: 'graph' })));
    act(() => { result.current.parseText(); });
    await waitFor(() => expect(result.current.parseStatus).toMatchObject({ status: 'error', err: 'bad', errorLine: 4 }));
  });
});

describe('useEditorPublish', () => {
  const base = (over) => ({
    mode: Mode.note, id: 'n1', name: 'メモ', text: 'hello', alias: 'memo', styleTemplateId: '',
    createMarked: vi.fn(),
    evt: { showErrorMessage: vi.fn(), showSuccessMessage: vi.fn(), showWarningMessage: vi.fn(), reloadUnpublished: vi.fn() },
    t,
    ...over,
  });

  beforeEach(() => {
    Browser.OpenURL = vi.fn(() => Promise.resolve());
    Unpublish.mockClear();
  });

  it('公開先をブラウザで開く（ノートは pages、index はルート、図は images）', async () => {
    const open = async (over) => {
      Browser.OpenURL.mockClear();
      const { result } = renderHook(() => useEditorPublish(base(over)));
      act(() => result.current.openInBrowser());
      return result;
    };
    await open({});
    await waitFor(() => expect(Browser.OpenURL).toHaveBeenCalledWith('http://localhost:1234/pages/memo.html'));
    await open({ id: 'index' });
    await waitFor(() => expect(Browser.OpenURL).toHaveBeenCalledWith('http://localhost:1234/'));
    await open({ mode: Mode.diagram, id: 'd1', alias: 'fig' });
    await waitFor(() => expect(Browser.OpenURL).toHaveBeenCalledWith('http://localhost:1234/images/fig.svg'));

    // 公開先の名前が無い・テンプレートは開かない
    await open({ alias: '' });
    await open({ mode: Mode.template });
    await act(async () => {});
    expect(Browser.OpenURL).not.toHaveBeenCalled();
  });

  it('非公開は、確認してから行う', async () => {
    const p = base();
    const { result } = renderHook(() => useEditorPublish(p));
    act(() => result.current.unpublish());
    expect(Unpublish).not.toHaveBeenCalled();
  });
});
