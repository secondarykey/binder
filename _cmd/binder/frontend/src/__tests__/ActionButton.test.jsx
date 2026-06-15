import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import { ActionButton } from '../dialogs/components/ActionButton';

describe('ActionButton', () => {
  it('renders with a tooltip label', () => {
    render(<ActionButton label="Save" icon={<SaveIcon />} variant="save" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders as disabled when disabled prop is true', () => {
    render(<ActionButton label="Close" icon={<CloseIcon />} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<ActionButton label="Save" icon={<SaveIcon />} onClick={handleClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
