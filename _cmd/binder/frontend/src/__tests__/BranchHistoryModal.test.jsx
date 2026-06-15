import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Event, { EventContext } from '../Event';

vi.mock('../app/OverallHistoryMenu', () => ({ default: () => <div>HistoryMenu</div> }));
vi.mock('../app/OverallHistoryDetail', () => ({ default: () => <div>HistoryDetail</div> }));
vi.mock('../dialogs/BranchModal', () => ({ BranchPanel: () => <div>BranchPanel</div> }));
vi.mock('../dialogs/components/DialogError', () => ({
  DialogErrorContext: { Provider: ({ children }) => children, Consumer: ({ children }) => children(null) },
  useDialogMessage: () => ({ showError: vi.fn(), showWarning: vi.fn() }),
}));

import BranchHistoryModal from '../app/BranchHistoryModal';

describe('BranchHistoryModal', () => {
  it('renders when open', () => {
    const evt = new Event();
    const { container } = render(
      <EventContext.Provider value={evt}>
        <BranchHistoryModal open={true} onClose={() => {}} />
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
