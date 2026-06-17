import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Message, { SystemMessage } from '../Message';
import Event, { EventContext } from '../Event';

describe('Message', () => {
  it('creates a message object', () => {
    const msg = Message.createMessage('success', 'hello');
    expect(msg.type).toBe('success');
    expect(msg.message).toBe('hello');
  });

  it('handles error objects with stack', () => {
    const err = new Error('test error');
    const msg = Message.createMessage('error', err);
    expect(msg.type).toBe('error');
    expect(msg.message).toContain('test error');
  });
});

describe('SystemMessage', () => {
  it('renders without crashing', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    render(
      <EventContext.Provider value={evt}>
        <SystemMessage />
      </EventContext.Provider>
    );
  });
});
