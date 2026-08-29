import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Event, { EventContext } from '../Event';

vi.mock('../../bindings/binder/api/app', () => ({
  GetHistories: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../bindings/main/window', () => ({
  OpenOverallHistoryWindow: vi.fn(),
}));
vi.mock('../app/App', () => ({ copyClipboard: vi.fn() }));

import BinderHistory from '../components/BinderHistory';
import { GetHistories } from '../../bindings/binder/api/app';
import { copyClipboard } from '../app/App';

describe('BinderHistory', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    const { container } = render(
      <EventContext.Provider value={evt}>
        <BinderHistory />
      </EventContext.Provider>
    );
    expect(container).toBeTruthy();
  });

  it('copies the binder path to the clipboard', async () => {
    GetHistories.mockResolvedValueOnce(['D:/work/binder1']);
    const evt = new Event();
    evt.showSuccessMessage = vi.fn();
    render(
      <EventContext.Provider value={evt}>
        <BinderHistory />
      </EventContext.Provider>
    );
    await screen.findByText('D:/work/binder1');
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(copyClipboard).toHaveBeenCalledWith('D:/work/binder1'));
    expect(evt.showSuccessMessage).toHaveBeenCalled();
  });
});
