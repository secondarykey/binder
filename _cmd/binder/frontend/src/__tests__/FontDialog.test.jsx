import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FontDialog from '@shared/editor/FontDialog';

describe('FontDialog', () => {
  const defaultProps = {
    open: true,
    font: { name: 'monospace', size: 14, color: '#e0e0e0', backgroundColor: '#1e1e1e' },
    fontNames: ['monospace', 'serif', 'sans-serif'],
    title: 'Font Settings',
    okLabel: 'OK',
    sampleLabel: 'Sample',
    labels: { name: 'Font', size: 'Size', color: 'Color', backgroundColor: 'Background' },
    onSave: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders the dialog with title', () => {
    render(<FontDialog {...defaultProps} />);
    expect(screen.getByText('Font Settings')).toBeInTheDocument();
  });

  it('renders OK button', () => {
    render(<FontDialog {...defaultProps} />);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<FontDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Font Settings')).not.toBeInTheDocument();
  });
});
