import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishRefsDialog, usePublishRefsDialog } from '../dialogs/PublishRefsDialog';

const refs = [
  { id: 'd1', type: 'diagram', name: 'Flow' },
  { id: 'a1', type: 'asset', name: 'logo.png' },
  { id: 'l1', type: 'layer', name: 'Callout' },
];

describe('PublishRefsDialog', () => {
  it('lists the references grouped by type, all checked', () => {
    render(<PublishRefsDialog open={true} refs={refs} onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText('Diagram')).toBeInTheDocument();
    expect(screen.getByText('Asset')).toBeInTheDocument();
    expect(screen.getByText('Layer')).toBeInTheDocument();
    for (const r of refs) {
      expect(screen.getByRole('checkbox', { name: r.name })).toBeChecked();
    }
  });

  it('passes only the checked references to onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<PublishRefsDialog open={true} refs={refs} onCancel={() => {}} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByText('logo.png'));
    expect(screen.getByRole('checkbox', { name: 'logo.png' })).not.toBeChecked();
    await userEvent.click(screen.getByTestId('PublishIcon').closest('button'));
    expect(onConfirm).toHaveBeenCalledWith([refs[0], refs[2]]);
  });

  it('calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<PublishRefsDialog open={true} refs={refs} onCancel={onCancel} onConfirm={() => {}} />);
    await userEvent.click(screen.getByTestId('CloseIcon').closest('button'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('usePublishRefsDialog', () => {
  // ask() を外から呼べるようにするテスト用の部品
  let ask;
  function Host() {
    const [dialog, a] = usePublishRefsDialog();
    ask = a;
    return dialog;
  }

  it('resolves with the selected references', async () => {
    render(<Host />);
    let result;
    await act(async () => { ask(refs).then((v) => { result = v; }); });
    await userEvent.click(screen.getByTestId('PublishIcon').closest('button'));
    expect(result).toEqual(refs);
  });

  it('resolves with null when cancelled', async () => {
    render(<Host />);
    let result = 'pending';
    await act(async () => { ask(refs).then((v) => { result = v; }); });
    await userEvent.click(screen.getByTestId('CloseIcon').closest('button'));
    expect(result).toBeNull();
  });
});
