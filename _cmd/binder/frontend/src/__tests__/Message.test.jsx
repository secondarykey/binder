import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  it('shows an action button and runs it', () => {
    const evt = new Event();
    const onClick = vi.fn();
    render(
      <EventContext.Provider value={evt}>
        <SystemMessage />
      </EventContext.Provider>
    );
    act(() => {
      evt.showMessage({ type: 'info', body: 'repaired', detail: '', debug: '', action: { label: 'History', onClick } });
    });
    expect(screen.getAllByText('repaired').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows no action button without an action', () => {
    const evt = new Event();
    render(
      <EventContext.Provider value={evt}>
        <SystemMessage />
      </EventContext.Provider>
    );
    act(() => {
      evt.showMessage({ type: 'info', body: 'plain', detail: '', debug: '' });
    });
    expect(screen.getAllByText('plain').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
