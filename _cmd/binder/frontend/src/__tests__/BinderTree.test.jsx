import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetBinderTree: vi.fn(() => Promise.resolve({ data: [] })),
  GetModifiedIds: vi.fn(() => Promise.resolve([])),
  GetUnpublishedTree: vi.fn(() => Promise.resolve([])),
  MoveNode: vi.fn(() => Promise.resolve()),
  DropAsset: vi.fn(() => Promise.resolve()),
  RemoveNote: vi.fn(() => Promise.resolve()),
  HasChildren: vi.fn(() => Promise.resolve(false)),
  RemoveDiagram: vi.fn(() => Promise.resolve()),
  RemoveAsset: vi.fn(() => Promise.resolve()),
  RemoveLayer: vi.fn(() => Promise.resolve()),
  IsGitBashPath: vi.fn(() => Promise.resolve(false)),
  GetGitBashFullPath: vi.fn(() => Promise.resolve('')),
  GetTreeDisplayMode: vi.fn(() => Promise.resolve('tree')),
  GetTreeExpandTargets: vi.fn(() => Promise.resolve([])),
  SaveLastData: vi.fn(() => Promise.resolve()),
  AddNote: vi.fn(() => Promise.resolve({})),
  AddDiagram: vi.fn(() => Promise.resolve({})),
  AddAsset: vi.fn(() => Promise.resolve({})),
  AddFolder: vi.fn(() => Promise.resolve({})),
  AddLayer: vi.fn(() => Promise.resolve({})),
  AddChild: vi.fn(() => Promise.resolve({})),
  GetConfig: vi.fn(() => Promise.resolve({})),
  Commit: vi.fn(() => Promise.resolve()),
  Generate: vi.fn(() => Promise.resolve()),
  Unpublish: vi.fn(() => Promise.resolve()),
  EnsureAddress: vi.fn(() => Promise.resolve('')),
  OpenNote: vi.fn(() => Promise.resolve('')),
  OpenDiagram: vi.fn(() => Promise.resolve('')),
  ParseNote: vi.fn(() => Promise.resolve('')),
  ParseDiagram: vi.fn(() => Promise.resolve('')),
  DownloadAsset: vi.fn(() => Promise.resolve()),
  GetHTMLTemplates: vi.fn(() => Promise.resolve({ layouts: [], contents: [] })),
  GetNote: vi.fn(() => Promise.resolve({})),
  GetDiagram: vi.fn(() => Promise.resolve({})),
  GetAsset: vi.fn(() => Promise.resolve({})),
  GetLayer: vi.fn(() => Promise.resolve({})),
  EditNote: vi.fn(() => Promise.resolve()),
  EditDiagram: vi.fn(() => Promise.resolve()),
  EditAsset: vi.fn(() => Promise.resolve()),
  EditLayer: vi.fn(() => Promise.resolve()),
  GetNoteImageURL: vi.fn(() => Promise.resolve('')),
  DeleteNoteImage: vi.fn(() => Promise.resolve()),
  UploadNoteImage: vi.fn(() => Promise.resolve()),
  PrivatizeChildren: vi.fn(() => Promise.resolve()),
  SaveContent: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../bindings/main/window', () => ({
  OpenHistoryWindow: vi.fn(),
  OpenSearchWindowWithQuery: vi.fn(),
  SelectFile: vi.fn(() => Promise.resolve('')),
}));
vi.mock('../clipboard', () => ({ copyClipboard: vi.fn() }));

import { GetBinderTree, HasChildren, RemoveNote, SaveLastData } from '../../bindings/binder/api/app';
import BinderTree from '../components/BinderTree';

describe('BinderTree', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ReloadTree, () => {});
    evt.register('test', Event.ReloadModified, () => {});
    evt.register('test', Event.SelectTree, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <BinderTree />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});

describe('BinderTree delete', () => {
  // index ─┬─ parent ── child
  //        └─ sibling
  const treeData = [{
    id: 'index', name: 'Index', type: 'note', children: [
      { id: 'parent', name: 'Parent', type: 'note', children: [
        { id: 'child', name: 'Child', type: 'note' },
      ] },
      { id: 'sibling', name: 'Sibling', type: 'note' },
    ],
  }];

  beforeEach(() => {
    vi.clearAllMocks();
    GetBinderTree.mockImplementation(() => Promise.resolve({ data: treeData }));
  });

  function LocationDisplay() {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}</div>;
  }

  async function renderAt(path) {
    const evt = new Event();
    const utils = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter initialEntries={[path]}>
          <BinderTree />
          <Routes><Route path="*" element={<LocationDisplay />} /></Routes>
        </MemoryRouter>
      </EventContext.Provider>
    );
    await screen.findByText('Index');
    return { ...utils, evt };
  }

  // ツリーで id を選んで Delete キーで削除する
  async function deleteByKey(container, evt, id, { withChildren = false } = {}) {
    act(() => evt.selectTreeNode(id));
    fireEvent.keyDown(container.querySelector('#treeScrollArea'), { key: 'Delete' });
    if (withChildren) {
      fireEvent.click(await screen.findByRole('checkbox', { name: 'note.deleteWithChildren' }));
    }
    const confirm = (await screen.findAllByTestId('DeleteIcon')).at(-1).closest('button');
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() => expect(RemoveNote).toHaveBeenCalled());
  }

  it('opens the parent note after deleting the opened note', async () => {
    HasChildren.mockImplementation(() => Promise.resolve(false));
    const { container, evt } = await renderAt('/editor/note/child');

    await deleteByKey(container, evt, 'child');
    expect(RemoveNote).toHaveBeenCalledWith('child', false);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/editor/note/parent'));
    expect(SaveLastData).toHaveBeenCalledWith('note', 'parent');
  });

  it('opens the parent note when the opened note is removed with its hierarchy', async () => {
    HasChildren.mockImplementation(() => Promise.resolve(true));
    const { container, evt } = await renderAt('/editor/note/child');

    await deleteByKey(container, evt, 'parent', { withChildren: true });
    expect(RemoveNote).toHaveBeenCalledWith('parent', true);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/editor/note/index'));
  });

  it('keeps the opened content when something else is deleted', async () => {
    HasChildren.mockImplementation(() => Promise.resolve(false));
    const { container, evt } = await renderAt('/editor/note/sibling');

    await deleteByKey(container, evt, 'child');
    // 削除後の処理（refreshTree など）が終わるのを待ってから確かめる
    await waitFor(() => expect(GetBinderTree.mock.calls.length).toBeGreaterThan(1));
    expect(screen.getByTestId('location').textContent).toBe('/editor/note/sibling');
  });
});
