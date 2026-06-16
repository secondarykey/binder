import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import IdStatusBar from '../components/editor/IdStatusBar';

describe('IdStatusBar', () => {
  it('renders without visible class when structure is null', () => {
    const { container } = render(<IdStatusBar structure={null} onNavigate={vi.fn()} />);
    const bar = container.querySelector('#idStatusBar');
    expect(bar).toBeTruthy();
    expect(bar.classList.contains('visible')).toBe(false);
    expect(container.querySelector('.idStatusLink')).toBeNull();
  });

  it('renders note info and navigates on click', () => {
    const onNavigate = vi.fn();
    const structure = { id: '019064da-7b5c-7c9a-8e5f-abc123def456', type: 'note', name: 'テスト' };
    const { container } = render(<IdStatusBar structure={structure} onNavigate={onNavigate} />);
    const link = container.querySelector('.idStatusLink');
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('テスト');
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith('note', '019064da-7b5c-7c9a-8e5f-abc123def456');
  });

  it('maps asset type to assets URL mode', () => {
    const onNavigate = vi.fn();
    const structure = { id: 'test-id', type: 'asset', name: '画像' };
    const { container } = render(<IdStatusBar structure={structure} onNavigate={onNavigate} />);
    fireEvent.click(container.querySelector('.idStatusLink'));
    expect(onNavigate).toHaveBeenCalledWith('assets', 'test-id');
  });
});
