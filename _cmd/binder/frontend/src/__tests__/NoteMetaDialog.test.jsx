import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetNote: vi.fn(() => Promise.resolve({})),
  GetHTMLTemplates: vi.fn(() => Promise.resolve({ layouts: [], contents: [] })),
  GetNoteImageURL: vi.fn(() => Promise.resolve('')),
  DeleteNoteImage: vi.fn(() => Promise.resolve()),
  UploadNoteImage: vi.fn(() => Promise.resolve()),
  EditNote: vi.fn(() => Promise.resolve()),
  RemoveNote: vi.fn(() => Promise.resolve()),
  PrivatizeChildren: vi.fn(() => Promise.resolve()),
  GetConfig: vi.fn(() => Promise.resolve({})),
  GetPublishSettings: vi.fn(() => Promise.resolve({})),
}));
vi.mock('../../bindings/main/window', () => ({
  SelectFile: vi.fn(() => Promise.resolve('')),
  OpenSearchWindowWithQuery: vi.fn(),
}));
vi.mock('../app/App', () => ({ copyClipboard: vi.fn() }));

import { EditNote, GetConfig, GetHTMLTemplates, GetNote, GetPublishSettings } from '../../bindings/binder/api/app';
import NoteMetaDialog from '../dialogs/NoteMetaDialog';

function renderDialog(id = 'test-id') {
  const evt = new Event();
  evt.register('test', Event.ShowMessage, () => {});
  return render(
    <EventContext.Provider value={evt}>
      <MemoryRouter>
        <NoteMetaDialog open={true} id={id} onClose={() => {}} />
      </MemoryRouter>
    </EventContext.Provider>
  );
}

const note = (alias, id = 'n1') => ({
  id, name: 'Not Found', alias, parentId: 'index',
  layoutTemplate: 'layout', contentTemplate: 'content',
});

// テストの i18n は未登録のキーをそのまま返す。alias 欄は折りたたまれた「Web公開」の中にあるので開く
async function openWebPublish(aliasValue) {
  const input = await screen.findByTestId('note-alias');
  await waitFor(() => expect(input.value).toBe(aliasValue));
  fireEvent.click(screen.getByText('meta.webPublish'));
  return input;
}

describe('NoteMetaDialog', () => {
  it('renders without crashing when open', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <NoteMetaDialog open={true} id="test-id" onClose={() => {}} />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    const evt = new Event();
    const { container } = render(
      <EventContext.Provider value={evt}>
        <MemoryRouter>
          <NoteMetaDialog open={false} id="" onClose={() => {}} />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  describe('404 page', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      GetHTMLTemplates.mockImplementation(() => Promise.resolve({
        layouts: [{ id: 'layout', name: 'Layout' }], contents: [{ id: 'content', name: 'Content' }],
      }));
      GetConfig.mockImplementation(() => Promise.resolve({ siteUrlGuess: 'https://u.github.io/repo/' }));
      GetPublishSettings.mockImplementation(() => Promise.resolve({}));
    });

    it('makes the note the 404 page and back', async () => {
      GetNote.mockImplementation(() => Promise.resolve(note('about')));
      renderDialog('n1');

      const input = await openWebPublish('about');
      const checkbox = screen.getByRole('checkbox', { name: 'note.errorPage' });
      expect(checkbox.checked).toBe(false);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
      // /404.html と表示し、編集させない
      expect(input.value).toBe('404');
      expect(input.disabled).toBe(true);

      // 外すと元の alias に戻る
      fireEvent.click(checkbox);
      expect(input.value).toBe('about');
      expect(input.disabled).toBe(false);

      fireEvent.click(checkbox);
      fireEvent.click(screen.getAllByTestId('CheckIcon').at(-1).closest('button'));
      await waitFor(() => expect(EditNote).toHaveBeenCalled());
      expect(EditNote.mock.calls[0][0].alias).toBe('/404');
    });

    it('unchecking a note opened as the 404 page restores the ID', async () => {
      GetNote.mockImplementation(() => Promise.resolve(note('/404')));
      renderDialog('n1');

      const input = await openWebPublish('404');
      const checkbox = screen.getByRole('checkbox', { name: 'note.errorPage' });
      expect(checkbox.checked).toBe(true);
      fireEvent.click(checkbox);
      expect(input.value).toBe('n1');
    });

    it('is not offered for the index note', async () => {
      GetNote.mockImplementation(() => Promise.resolve(note('index', 'index')));
      renderDialog('index');

      await openWebPublish('index');
      expect(screen.queryByRole('checkbox', { name: 'note.errorPage' })).toBeNull();
    });

    it('warns when the site URL is unknown', async () => {
      GetConfig.mockImplementation(() => Promise.resolve({}));
      GetNote.mockImplementation(() => Promise.resolve(note('/404')));
      renderDialog('n1');

      await openWebPublish('404');
      expect(await screen.findByText('note.errorPageNoSiteUrl')).toBeTruthy();
    });

    it('warns when the published data is sent to a subdirectory', async () => {
      GetPublishSettings.mockImplementation(() => Promise.resolve({ publishOnly: true, publishSubDir: 'en' }));
      GetNote.mockImplementation(() => Promise.resolve(note('/404')));
      renderDialog('n1');

      await openWebPublish('404');
      expect(await screen.findByText('note.errorPageSubDir')).toBeTruthy();
    });

    it('does not warn for ordinary notes', async () => {
      GetConfig.mockImplementation(() => Promise.resolve({}));
      GetNote.mockImplementation(() => Promise.resolve(note('about')));
      renderDialog('n1');

      await openWebPublish('about');
      expect(screen.queryByText('note.errorPageNoSiteUrl')).toBeNull();
    });
  });
});
