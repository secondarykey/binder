import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import { DialogErrorContext } from '../dialogs/components/DialogError';

vi.mock('../../bindings/binder/api/app', () => ({
  ListRootFiles: vi.fn(() => Promise.resolve([])),
  ReadRootFile: vi.fn(() => Promise.resolve('')),
  SaveRootFile: vi.fn(() => Promise.resolve()),
  RemoveRootFile: vi.fn(() => Promise.resolve()),
  RenameRootFile: vi.fn(() => Promise.resolve()),
  ListRootFileTemplates: vi.fn(() => Promise.resolve(['AGENTS.md'])),
  ReadRootFileTemplate: vi.fn(() => Promise.resolve('# AGENTS.md\n')),
}));

import { ListRootFiles, SaveRootFile, ReadRootFileTemplate, ListRootFileTemplates } from '../../bindings/binder/api/app';
import RootFileSetting from '../dialogs/RootFileSetting';

function renderSetting() {
  const evt = new Event();
  evt.register('test', Event.ShowMessage, () => {});
  const ctx = { setMsg: vi.fn(), clearMsg: vi.fn() };
  return render(
    <EventContext.Provider value={evt}>
      <DialogErrorContext.Provider value={ctx}>
        <RootFileSetting />
      </DialogErrorContext.Provider>
    </EventContext.Provider>
  );
}

describe('RootFileSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = renderSetting();
    expect(container).toBeTruthy();
  });

  it('writes AGENTS.md only when the template is chosen', async () => {
    renderSetting();
    // 開いただけでは何も書かない
    await waitFor(() => expect(ListRootFileTemplates).toHaveBeenCalled());
    expect(SaveRootFile).not.toHaveBeenCalled();

    fireEvent.click((await screen.findByLabelText('rootFile.addFromTemplate')).querySelector('button'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'AGENTS.md' }));

    await waitFor(() => expect(SaveRootFile).toHaveBeenCalledWith('AGENTS.md', '# AGENTS.md\n'));
    expect(ReadRootFileTemplate).toHaveBeenCalledWith('AGENTS.md');
  });

  it('does not offer a template whose file already exists', async () => {
    ListRootFiles.mockImplementation(() => Promise.resolve([{ name: 'agents.md' }]));
    renderSetting();
    await screen.findByText('agents.md');

    fireEvent.click((await screen.findByLabelText('rootFile.addFromTemplate')).querySelector('button'));
    const item = await screen.findByRole('menuitem', { name: 'AGENTS.md' });
    expect(item.getAttribute('aria-disabled')).toBe('true');
  });
});
