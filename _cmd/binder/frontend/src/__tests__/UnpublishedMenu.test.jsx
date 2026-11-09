import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  GetUnpublishedTree: vi.fn(() => Promise.resolve([])),
  GetPublishedNotesByTemplate: vi.fn(() => Promise.resolve([])),
  GetPublishedTree: vi.fn(() => Promise.resolve([])),
  OpenNote: vi.fn(() => Promise.resolve('')),
  GetUnpublishedRefs: vi.fn(() => Promise.resolve([])),
  GenerateAll: vi.fn(() => Promise.resolve([])),
  UnpublishAll: vi.fn(() => Promise.resolve()),
}));

vi.mock('../publish-items', async (importOriginal) => ({
  ...(await importOriginal()),
  renderPublishItem: vi.fn((leaf) => Promise.resolve({
    mode: leaf.type === 'asset' ? 'assets' : leaf.type, id: leaf.id, data: '',
  })),
}));

import { GetUnpublishedTree, GetUnpublishedRefs, GenerateAll } from '../../bindings/binder/api/app';
import UnpublishedMenu from '../dialogs/UnpublishedMenu';

function renderMenu(evt) {
  const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
  return render(
    <EventContext.Provider value={evt}>
      <DialogErrorContext.Provider value={ctx}>
        <MemoryRouter>
          <UnpublishedMenu date="2024-01-01" onClose={() => {}} />
        </MemoryRouter>
      </DialogErrorContext.Provider>
    </EventContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UnpublishedMenu', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.PublishGenerate, () => {});
    evt.register('test', Event.ReloadUnpublished, () => {});
    const { container } = renderMenu(evt);
    expect(container).toBeTruthy();
  });

  describe('publishing references of the selected notes', () => {
    const note = { id: 'n1', name: 'Intro', type: 'note' };
    const listed = { id: 'a1', name: 'listed.png', type: 'asset' };
    const ref = { id: 'd1', name: 'Flow', type: 'diagram', styleTemplate: '' };

    beforeEach(() => {
      GetUnpublishedTree.mockResolvedValue({
        data: [
          { id: 'DIR_Note', children: [note] },
          { id: 'DIR_Asset', children: [listed] },
        ],
      });
      // 一覧にあるアセットと、一覧にない図を参照している
      GetUnpublishedRefs.mockResolvedValue([listed, ref]);
    });

    const generate = async (evt) => {
      renderMenu(evt);
      await screen.findByText('Intro');
      await act(async () => { evt.raise(Event.PublishGenerate, 'Generate:'); });
    };

    it('asks only about references that are not selected and publishes the chosen ones', async () => {
      const evt = new Event();
      await generate(evt);

      // 一覧で選ばれているアセットは聞かない
      expect(await screen.findByRole('checkbox', { name: 'Flow' })).toBeChecked();
      expect(screen.queryByRole('checkbox', { name: 'listed.png' })).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId('PublishIcon').closest('button'));

      await waitFor(() => expect(GenerateAll).toHaveBeenCalledTimes(1));
      const [items, comment] = GenerateAll.mock.calls[0];
      expect(items.map((i) => i.id)).toEqual(['n1', 'a1', 'd1']);
      expect(comment).toBe('Generate:\n  Diagram:\n    Flow');
    });

    it('does not publish anything when cancelled', async () => {
      const evt = new Event();
      await generate(evt);

      await userEvent.click((await screen.findByTestId('CloseIcon')).closest('button'));
      // 取り消したら生成しない
      await new Promise((r) => setTimeout(r, 50));
      expect(GenerateAll).not.toHaveBeenCalled();
    });

    it('publishes without asking when every reference is selected', async () => {
      GetUnpublishedRefs.mockResolvedValue([listed]);
      const evt = new Event();
      await generate(evt);

      await waitFor(() => expect(GenerateAll).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('publishRefs.title')).not.toBeInTheDocument();
      expect(GenerateAll.mock.calls[0][0].map((i) => i.id)).toEqual(['n1', 'a1']);
    });
  });
});
