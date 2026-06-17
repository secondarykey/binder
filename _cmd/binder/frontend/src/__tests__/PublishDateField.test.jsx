import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PublishDateField from '../dialogs/components/PublishDateField';

describe('PublishDateField', () => {
  it('renders label and dash when value is null', () => {
    render(<PublishDateField label="Published" value={null} />);
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders formatted date when value is a Date', () => {
    const date = new Date(2025, 0, 15, 10, 30, 45);
    render(<PublishDateField label="Published" value={date} />);
    expect(screen.getByText('2025-01-15 10:30:45')).toBeInTheDocument();
  });

  it('renders dash for invalid date', () => {
    render(<PublishDateField label="Published" value="not-a-date" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
