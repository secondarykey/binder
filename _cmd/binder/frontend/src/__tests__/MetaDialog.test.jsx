import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Event, { EventContext } from '../Event';

vi.mock('../app/App', () => ({ copyClipboard: vi.fn() }));

import MetaDialog from '../dialogs/components/MetaDialog';

describe('MetaDialog', () => {
  const evt = new Event();
  const wrap = (ui) => <EventContext.Provider value={evt}>{ui}</EventContext.Provider>;

  it('renders title and children when open', () => {
    render(wrap(
      <MetaDialog open={true} onClose={() => {}} title="Edit Note" id="abc-123" onSave={() => {}}>
        <div>child content</div>
      </MetaDialog>
    ));
    expect(screen.getByText('Edit Note')).toBeInTheDocument();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('shows ID when showId is true', () => {
    render(wrap(
      <MetaDialog open={true} onClose={() => {}} title="Edit" id="test-id-123" onSave={() => {}}>
        <div />
      </MetaDialog>
    ));
    expect(screen.getByText(/test-id-123/)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(wrap(
      <MetaDialog open={false} onClose={() => {}} title="Edit" id="abc" onSave={() => {}}>
        <div />
      </MetaDialog>
    ));
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });
});
