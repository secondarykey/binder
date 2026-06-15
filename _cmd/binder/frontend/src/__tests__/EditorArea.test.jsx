import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditorArea from '@shared/editor/EditorArea';

describe('EditorArea', () => {
  it('renders a textarea with the provided text', () => {
    render(<EditorArea text="Hello World" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hello World')).toBeInTheDocument();
  });

  it('renders line numbers by default', () => {
    render(<EditorArea text={"line1\nline2\nline3"} onChange={() => {}} />);
    const { container } = render(<EditorArea text={"a\nb\nc"} onChange={() => {}} />);
    const lineNumbers = container.querySelector('.editorLineNumbers');
    expect(lineNumbers).toBeInTheDocument();
  });

  it('hides line numbers when showLineNumbers is false', () => {
    const { container } = render(<EditorArea text="line1" showLineNumbers={false} onChange={() => {}} />);
    expect(container.querySelector('.editorLineNumbers')).toBeNull();
  });
});
