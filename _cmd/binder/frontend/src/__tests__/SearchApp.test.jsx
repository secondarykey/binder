import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Window } from '@wailsio/runtime';

vi.mock('../../bindings/binder/api/app', () => ({
  SearchBinder: vi.fn(() => Promise.resolve([])),
}));

import SearchApp, { NO_MAX_SIZE } from '../app/SearchApp';

describe('SearchApp', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    Window.SetMaxSize.mockClear();
  });

  it('renders without crashing', () => {
    const { container } = render(<SearchApp />);
    expect(container).toBeTruthy();
  });

  it('fixes the height before searching', () => {
    render(<SearchApp />);
    expect(Window.SetMaxSize).toHaveBeenCalledWith(9999, 46);
  });

  it('lifts the size limit with a large value, not (0, 0)', () => {
    // Linux（GTK4）版の Wails は SetMaxSize(0, 0) で前の制限を消さない
    window.history.replaceState(null, '', '/?search=1&q=hello');
    render(<SearchApp />);
    expect(Window.SetMaxSize).toHaveBeenCalledWith(NO_MAX_SIZE, NO_MAX_SIZE);
    expect(Window.SetMaxSize).not.toHaveBeenCalledWith(0, 0);
  });
});
