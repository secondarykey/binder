import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../dialogs/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders title and message when open', () => {
    render(
      <ConfirmDialog open={true} title="Delete?" message="Are you sure?" onCancel={() => {}} onConfirm={() => {}} />
    );
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <ConfirmDialog open={false} title="Delete?" message="Are you sure?" onCancel={() => {}} onConfirm={() => {}} />
    );
    expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const handleConfirm = vi.fn();
    render(
      <ConfirmDialog open={true} title="Delete?" message="Are you sure?" onCancel={() => {}} onConfirm={handleConfirm} />
    );
    const buttons = screen.getAllByRole('button');
    const confirmButton = buttons[buttons.length - 1];
    await userEvent.click(confirmButton);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });
});
