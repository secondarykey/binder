import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Event, { EventContext, useEventListener } from '../Event';

describe('Event', () => {
  it('subscribes with on() and dispatches via raise()', () => {
    const evt = new Event();
    const handler = vi.fn();
    evt.on(Event.ReloadTree, handler);
    evt.raise(Event.ReloadTree, 'data');
    expect(handler).toHaveBeenCalledWith('data');
  });

  it('on() returns an unsubscribe function', () => {
    const evt = new Event();
    const handler = vi.fn();
    const off = evt.on(Event.ReloadTree, handler);
    off();
    evt.raise(Event.ReloadTree, 'data');
    expect(handler).not.toHaveBeenCalled();
  });

  it('raise() with no listeners is a no-op', () => {
    const evt = new Event();
    expect(() => evt.raise(Event.ReloadTree, 'data')).not.toThrow();
  });

  it('register() remains as a backward-compat shim', () => {
    const evt = new Event();
    const handler = vi.fn();
    evt.register('test', Event.ReloadTree, handler);
    evt.raise(Event.ReloadTree, 'data');
    expect(handler).toHaveBeenCalledWith('data');
  });

  it('provides static event keys', () => {
    expect(Event.ReloadTree).toBe('tree.reload');
    expect(Event.ShowMessage).toBe('message.show');
    expect(Event.ChangeAddress).toBe('change.address');
  });

  it('exports EventContext', () => {
    expect(EventContext).toBeDefined();
  });
});

describe('useEventListener', () => {
  function Listener({ onEvent }) {
    useEventListener(Event.ReloadTree, onEvent);
    return null;
  }

  it('subscribes while mounted and auto-unsubscribes on unmount', () => {
    const evt = new Event();
    const handler = vi.fn();
    const { unmount } = render(
      <EventContext.Provider value={evt}>
        <Listener onEvent={handler} />
      </EventContext.Provider>
    );

    evt.raise(Event.ReloadTree, 'x');
    expect(handler).toHaveBeenCalledWith('x');

    unmount();
    evt.raise(Event.ReloadTree, 'y');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('always calls the latest handler closure', () => {
    const evt = new Event();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <EventContext.Provider value={evt}>
        <Listener onEvent={first} />
      </EventContext.Provider>
    );

    rerender(
      <EventContext.Provider value={evt}>
        <Listener onEvent={second} />
      </EventContext.Provider>
    );

    evt.raise(Event.ReloadTree, 'z');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('z');
  });
});
