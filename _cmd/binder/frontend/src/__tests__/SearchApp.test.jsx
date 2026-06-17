import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../bindings/binder/api/app', () => ({
  SearchBinder: vi.fn(() => Promise.resolve([])),
}));

import SearchApp from '../app/SearchApp';

describe('SearchApp', () => {
  it('renders without crashing', () => {
    const { container } = render(<SearchApp />);
    expect(container).toBeTruthy();
  });
});
