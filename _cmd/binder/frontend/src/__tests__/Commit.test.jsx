import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Event, { EventContext } from '../Event';
import Commit from '../components/Commit';

describe('Commit', () => {
  it('renders commit form with comment field', () => {
    const evt = new Event();
    evt.register('test', Event.ModifiedComment, () => {});
    evt.register('test', Event.ModifiedProgress, () => {});
    render(
      <EventContext.Provider value={evt}>
        <MemoryRouter initialEntries={['/status/modified/2024-01-01']}>
          <Commit date="2024-01-01" />
        </MemoryRouter>
      </EventContext.Provider>
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
