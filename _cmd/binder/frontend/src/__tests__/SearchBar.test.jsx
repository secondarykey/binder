import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SearchBar from '@shared/editor/SearchBar';

describe('SearchBar', () => {
  it('renders the search input', () => {
    render(<SearchBar text="sample text" onClose={() => {}} onNavigate={() => {}} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('renders close button', () => {
    const { container } = render(<SearchBar text="sample" onClose={() => {}} onNavigate={() => {}} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
