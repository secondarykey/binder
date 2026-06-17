import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import IdStatusBar from '../components/editor/IdStatusBar';

describe('IdStatusBar', () => {
  it('renders without visible class when structures is empty', () => {
    const { container } = render(<IdStatusBar structures={[]} currentIndex={0} onIndexChange={vi.fn()} onNavigate={vi.fn()} />);
    const bar = container.querySelector('#idStatusBar');
    expect(bar).toBeTruthy();
    expect(bar.classList.contains('visible')).toBe(false);
    expect(container.querySelector('.idStatusLink')).toBeNull();
  });

  it('renders note info and navigates on click', () => {
    const onNavigate = vi.fn();
    const structures = [{ id: '019064da-7b5c-7c9a-8e5f-abc123def456', type: 'note', name: 'テスト' }];
    const { container } = render(<IdStatusBar structures={structures} currentIndex={0} onIndexChange={vi.fn()} onNavigate={onNavigate} />);
    const link = container.querySelector('.idStatusLink');
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('テスト');
    expect(container.querySelector('.idStatusNav')).toBeNull();
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith('note', '019064da-7b5c-7c9a-8e5f-abc123def456');
  });

  it('maps asset type to assets URL mode', () => {
    const onNavigate = vi.fn();
    const structures = [{ id: 'test-id', type: 'asset', name: '画像' }];
    const { container } = render(<IdStatusBar structures={structures} currentIndex={0} onIndexChange={vi.fn()} onNavigate={onNavigate} />);
    fireEvent.click(container.querySelector('.idStatusLink'));
    expect(onNavigate).toHaveBeenCalledWith('assets', 'test-id');
  });

  it('shows navigation buttons when multiple structures exist', () => {
    const onIndexChange = vi.fn();
    const structures = [
      { id: 'id-1', type: 'note', name: 'A' },
      { id: 'id-2', type: 'diagram', name: 'B' },
    ];
    const { container } = render(<IdStatusBar structures={structures} currentIndex={0} onIndexChange={onIndexChange} onNavigate={vi.fn()} />);
    expect(container.querySelector('.idStatusNav')).toBeTruthy();
    expect(container.querySelector('.idStatusCount').textContent).toBe('1/2');

    const btns = container.querySelectorAll('.idStatusNavBtn');
    fireEvent.click(btns[1]);
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });
});
