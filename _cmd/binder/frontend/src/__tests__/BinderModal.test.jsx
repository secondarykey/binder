import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Event, { EventContext } from '../Event';

vi.mock('../dialogs/Binder', () => ({ default: () => <div>Binder content</div> }));
vi.mock('../dialogs/components/DialogError', () => ({
  DialogErrorContext: { Provider: ({ children }) => children, Consumer: ({ children }) => children(null) },
  useDialogMessage: () => ({ showError: vi.fn(), showWarning: vi.fn() }),
}));

import BinderModal from '../dialogs/BinderModal';

describe('BinderModal', () => {
  it('renders when open', () => {
    const evt = new Event();
    render(
      <EventContext.Provider value={evt}>
        <BinderModal open={true} onClose={() => {}} />
      </EventContext.Provider>
    );
    expect(screen.getByText('Binder content')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    const evt = new Event();
    render(
      <EventContext.Provider value={evt}>
        <BinderModal open={false} onClose={() => {}} />
      </EventContext.Provider>
    );
    expect(screen.queryByText('Binder content')).not.toBeInTheDocument();
  });
});
