import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext } from '../Event';

vi.mock('../app/OverallHistoryMenu', () => ({ default: () => <div>HistoryMenu</div> }));
vi.mock('../app/OverallHistoryDetail', () => ({ default: () => <div>HistoryDetail</div> }));
vi.mock('../dialogs/BranchModal', () => ({ BranchPanel: () => <div>BranchPanel</div> }));
vi.mock('../dialogs/components/DialogError', () => ({
  DialogErrorContext: { Provider: ({ children }) => children, Consumer: ({ children }) => children(null) },
  useDialogMessage: () => ({ showError: vi.fn(), showWarning: vi.fn() }),
}));

import OverallHistoryApp from '../app/OverallHistoryApp';

describe('OverallHistoryApp', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    const { container } = render(
      <EventContext.Provider value={evt}>
        <OverallHistoryApp />
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });
});
