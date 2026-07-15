import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConvertDialog, { NeedUpdateDialog, TooOldDialog, BinderTooOldDialog } from '../dialogs/components/ConvertDialog';

describe('ConvertDialog', () => {
  it('renders title when open', () => {
    render(<ConvertDialog open={true} appVersion="1.0.0" binderVersion="0.9.0" onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<ConvertDialog open={false} appVersion="1.0.0" binderVersion="0.9.0" onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onConfirm on confirm click', async () => {
    const onConfirm = vi.fn();
    render(<ConvertDialog open={true} appVersion="1.0.0" binderVersion="0.9.0" onCancel={() => {}} onConfirm={onConfirm} />);
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[buttons.length - 1]);
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe('NeedUpdateDialog', () => {
  it('renders when open', () => {
    render(<NeedUpdateDialog open={true} appVersion="1.0.0" binderVersion="2.0.0" onClose={() => {}} onForceOpen={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('TooOldDialog', () => {
  it('renders when open', () => {
    render(<TooOldDialog open={true} appVersion="0.1.0" minAppVersion="1.0.0" onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('BinderTooOldDialog', () => {
  it('renders title and version info when open', () => {
    render(<BinderTooOldDialog open={true} binderVersion="0.1.0" minBinderVersion="1.0.0" onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('convert.binderTooOldTitle')).toBeInTheDocument();
    expect(screen.getByText('convert.binderTooOldVersionInfo')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<BinderTooOldDialog open={false} binderVersion="0.1.0" minBinderVersion="1.0.0" onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose on OK click', async () => {
    const onClose = vi.fn();
    render(<BinderTooOldDialog open={true} binderVersion="0.1.0" minBinderVersion="1.0.0" onClose={onClose} />);
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[buttons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });
});
