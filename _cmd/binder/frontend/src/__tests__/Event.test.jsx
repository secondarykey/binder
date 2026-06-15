import { describe, it, expect, vi } from 'vitest';
import Event, { EventContext } from '../Event';

describe('Event', () => {
  it('registers and raises events', () => {
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
