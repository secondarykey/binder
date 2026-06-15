import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Event, { EventContext } from '../Event';

vi.mock('../dialogs/UnpublishedMenu', () => ({ default: () => <div>UnpublishedMenu</div> }));
vi.mock('../dialogs/GenerateForm', () => ({ default: () => <div>GenerateForm</div> }));
vi.mock('../dialogs/components/DialogError', () => ({
  DialogErrorContext: { Provider: ({ children }) => children, Consumer: ({ children }) => children(null) },
  useDialogMessage: () => ({ showError: vi.fn(), showWarning: vi.fn() }),
}));

import PublishModal from '../dialogs/PublishModal';

describe('PublishModal', () => {
  it('renders when open', () => {
    const evt = new Event();
    render(
      <EventContext.Provider value={evt}>
        <PublishModal open={true} onClose={() => {}} />
      </EventContext.Provider>
    );
    expect(screen.getByText('UnpublishedMenu')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    const evt = new Event();
    render(
      <EventContext.Provider value={evt}>
        <PublishModal open={false} onClose={() => {}} />
      </EventContext.Provider>
    );
    expect(screen.queryByText('UnpublishedMenu')).not.toBeInTheDocument();
  });
});
