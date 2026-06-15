import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tree from '../components/Tree';

const sampleData = [
  {
    id: 'root',
    name: 'Root',
    type: 'folder',
    children: [
      { id: 'child1', name: 'Child 1', type: 'file' },
      { id: 'child2', name: 'Child 2', type: 'file' },
    ],
  },
];

describe('Tree', () => {
  it('renders root node', () => {
    render(<Tree data={sampleData} />);
    expect(screen.getByText('Root')).toBeInTheDocument();
  });

  it('renders child nodes', () => {
    render(<Tree data={sampleData} expand={['root']} />);
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });

  it('calls onClick when a node is clicked', async () => {
    const handleClick = vi.fn();
    render(<Tree data={sampleData} onClick={handleClick} expand={['root']} />);
    await userEvent.click(screen.getByText('Child 1'));
    expect(handleClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'child1' }));
  });
});
