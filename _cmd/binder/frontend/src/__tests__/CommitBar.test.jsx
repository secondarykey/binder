import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommitBar from '../components/CommitBar';

describe('CommitBar', () => {
  it('renders with a text field showing the comment', () => {
    render(<CommitBar comment="test comment" onCommentChange={() => {}} updated={false} onCommit={() => {}} />);
    expect(screen.getByDisplayValue('test comment')).toBeInTheDocument();
  });

  it('calls onCommentChange when typing', async () => {
    const handleChange = vi.fn();
    render(<CommitBar comment="" onCommentChange={handleChange} updated={false} onCommit={() => {}} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'a');
    expect(handleChange).toHaveBeenCalled();
  });
});
