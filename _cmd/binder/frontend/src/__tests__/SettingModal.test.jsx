import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Event, { EventContext } from '../Event';

vi.mock('../dialogs/Setting', () => ({ default: () => <div>Setting content</div> }));
vi.mock('../dialogs/components/DialogError', () => ({
  DialogErrorContext: { Provider: ({ children }) => children, Consumer: ({ children }) => children(null) },
  useDialogMessage: () => ({ showError: vi.fn(), showWarning: vi.fn() }),
}));

import SettingModal from '../dialogs/SettingModal';

describe('SettingModal', () => {
  it('renders when open', () => {
    const evt = new Event();
    render(
      <EventContext.Provider value={evt}>
        <SettingModal open={true} onClose={() => {}} />
      </EventContext.Provider>
    );
    expect(screen.getByText('Setting content')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    const evt = new Event();
    render(
      <EventContext.Provider value={evt}>
        <SettingModal open={false} onClose={() => {}} />
      </EventContext.Provider>
    );
    expect(screen.queryByText('Setting content')).not.toBeInTheDocument();
  });
});
