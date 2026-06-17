import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Event, { EventContext } from '../Event';

vi.mock('../dialogs/ModifiedMenu', () => ({ default: () => <div>ModifiedMenu</div> }));
vi.mock('../components/Commit', () => ({ default: () => <div>CommitForm</div> }));
vi.mock('../components/Patch', () => ({ default: () => <div>PatchView</div> }));
vi.mock('../dialogs/components/DialogError', () => ({
  DialogErrorContext: { Provider: ({ children }) => children, Consumer: ({ children }) => children(null) },
  useDialogMessage: () => ({ showError: vi.fn(), showWarning: vi.fn() }),
}));

import CommitModal from '../dialogs/CommitModal';

describe('CommitModal', () => {
  it('renders commit view when open', () => {
    const evt = new Event();
    render(
      <EventContext.Provider value={evt}>
        <CommitModal open={true} onClose={() => {}} />
      </EventContext.Provider>
    );
    expect(screen.getByText('ModifiedMenu')).toBeInTheDocument();
    expect(screen.getByText('CommitForm')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    const evt = new Event();
    render(
      <EventContext.Provider value={evt}>
        <CommitModal open={false} onClose={() => {}} />
      </EventContext.Provider>
    );
    expect(screen.queryByText('ModifiedMenu')).not.toBeInTheDocument();
  });
});
