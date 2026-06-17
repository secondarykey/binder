import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Event, { EventContext } from '../Event';
import GenerateForm from '../dialogs/GenerateForm';

describe('GenerateForm', () => {
  it('renders generate form with comment field', () => {
    const evt = new Event();
    evt.register('test', Event.PublishComment, () => {});
    evt.register('test', Event.PublishProgress, () => {});
    render(
      <EventContext.Provider value={evt}>
        <GenerateForm date="2024-01-01" />
      </EventContext.Provider>
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
