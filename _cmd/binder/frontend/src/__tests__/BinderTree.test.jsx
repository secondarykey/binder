import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetBinderTree: vi.fn(() => Promise.resolve({ data: [] })),
  GetModifiedIds: vi.fn(() => Promise.resolve([])),
  GetUnpublishedTree: vi.fn(() => Promise.resolve([])),
  MoveNode: vi.fn(() => Promise.resolve()),
  DropAsset: vi.fn(() => Promise.resolve()),
  RemoveNote: vi.fn(() => Promise.resolve()),
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
vi.mock('../app/App', () => ({ copyClipboard: vi.fn() }));

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
