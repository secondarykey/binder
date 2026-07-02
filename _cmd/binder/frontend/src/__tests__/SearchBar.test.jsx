import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SearchBar from '@shared/editor/SearchBar';

// jsdom には scrollIntoView が無い（一致リストのアクティブ表示で使用）
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

describe('SearchBar', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the search input', () => {
    render(<SearchBar text="sample text" onClose={() => {}} onNavigate={() => {}} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('renders close button', () => {
    const { container } = render(<SearchBar text="sample" onClose={() => {}} onNavigate={() => {}} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('does not navigate when text changes while search is active', () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    const { rerender } = render(
      <SearchBar text="alpha beta" onClose={() => {}} onNavigate={onNavigate} />
    );
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'beta' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledTimes(1);

    // 本文編集で再検索が走ってもカーソル（onNavigate）は奪わない
    rerender(<SearchBar text="alpha gamma beta" onClose={() => {}} onNavigate={onNavigate} />);
    act(() => { vi.advanceTimersByTime(300); });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  it('debounces re-search on rapid text changes', () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    const { rerender } = render(
      <SearchBar text="one two" onClose={() => {}} onNavigate={onNavigate} />
    );
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'two' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('1 / 1')).toBeInTheDocument();

    // 300ms 未満の連続変更では再検索されない（一致数が古いまま）
    rerender(<SearchBar text="one two two" onClose={() => {}} onNavigate={onNavigate} />);
    act(() => { vi.advanceTimersByTime(200); });
    rerender(<SearchBar text="one two two two" onClose={() => {}} onNavigate={onNavigate} />);
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText('1 / 1')).toBeInTheDocument();

    // 最後の変更から 300ms 経過で最新テキストに対して再検索される
    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });
});
