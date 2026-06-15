import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';

vi.mock('../dialogs/components/DialogError', () => ({
  DialogErrorContext: { Provider: ({ children }) => children, Consumer: ({ children }) => children(null) },
  useDialogMessage: () => ({ showError: vi.fn(), showWarning: vi.fn() }),
}));

import TableDialog from '../dialogs/TableDialog';

describe('TableDialog', () => {
  it('renders without crashing when open', () => {
    const evt = new Event();
    const { container } = render(
      <EventContext.Provider value={evt}>
        <TableDialog open={true} onClose={() => {}} onInsert={() => {}} />
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
