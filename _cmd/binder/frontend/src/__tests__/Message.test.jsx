import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Message, { SystemMessage } from '../Message';
import Event, { EventContext } from '../Event';

describe('Message', () => {
  it('creates a message object', () => {
    const msg = Message.createMessage('success', 'hello');
    expect(msg.type).toBe('success');
    expect(msg.body).toBe('hello');
  });

  it('handles error objects', () => {
    const err = new Error('test error');
    const msg = Message.createMessage('error', err);
    expect(msg.type).toBe('error');
    expect(msg.body).toContain('test error');
  });

  it('extracts body from a Wails structured (cause) error envelope', () => {
    const envelope = JSON.stringify({
      message: 'RemoveNote() error',
      cause: { body: '子要素があるノートは削除できません', detail: 'has children', cause: 'note has children: id' },
      kind: 'RuntimeError',
    });
    const err = new Error(envelope);
    const msg = Message.createMessage('error', err);
    expect(msg.body).toBe('子要素があるノートは削除できません');
    expect(msg.detail).toBe('has children');
    expect(msg.debug).toContain('note has children: id');
  });

  it('falls back to first line of message for unconverted Go errors', () => {
    const envelope = JSON.stringify({
      message: 'GetNote() error\n stack trace line\n more',
      cause: {},
      kind: 'RuntimeError',
    });
    const err = new Error(envelope);
    const msg = Message.createMessage('error', err);
    expect(msg.body).toBe('GetNote() error');
    expect(msg.debug).toContain('stack trace line');
  });

  it('respects kind from Go side (info overrides error)', () => {
    const envelope = JSON.stringify({
      message: 'No changes to record',
      cause: { body: 'No changes to record', kind: 'info' },
      kind: 'RuntimeError',
    });
    const err = new Error(envelope);
    const msg = Message.createMessage('error', err);
    expect(msg.type).toBe('info');
    expect(msg.body).toBe('No changes to record');
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
