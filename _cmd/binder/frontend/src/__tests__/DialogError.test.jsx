import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DialogErrorContext, useDialogMessage } from '../dialogs/components/DialogError';
import { EventContext } from '../Event';
import Event from '../Event';

describe('DialogErrorContext', () => {
  it('is a valid React context', () => {
    expect(DialogErrorContext).toBeDefined();
    expect(DialogErrorContext.Provider).toBeDefined();
  });
});

describe('useDialogMessage', () => {
  it('returns showError and showWarning functions', () => {
    const evt = new Event();
    evt.register('test', Event.ShowMessage, () => {});
    const wrapper = ({ children }) => (
      <EventContext.Provider value={evt}>{children}</EventContext.Provider>
    );
    const { result } = renderHook(() => useDialogMessage(), { wrapper });
    expect(typeof result.current.showError).toBe('function');
    expect(typeof result.current.showWarning).toBe('function');
  });
});
