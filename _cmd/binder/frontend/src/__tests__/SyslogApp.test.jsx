import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../bindings/main/window', () => ({
  ReadLogTail: vi.fn(() => Promise.resolve('')),
  GetLogLevel: vi.fn(() => Promise.resolve('info')),
  SetLogLevel: vi.fn(() => Promise.resolve()),
}));

import SyslogApp from '../app/SyslogApp';

describe('SyslogApp', () => {
  it('renders without crashing', () => {
    const { container } = render(<SyslogApp />);
    expect(container).toBeTruthy();
  });
});
