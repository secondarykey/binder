import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../bindings/binder/api/shared/shared', () => ({
  GetFontNames: vi.fn(() => Promise.resolve([])),
}));

import FontDialog from '../dialogs/FontDialog';

describe('FontDialog (Binder)', () => {
  it('renders without crashing when shown', () => {
    const { container } = render(
      <FontDialog show={true} font={{}} onClose={() => {}} />
    );
    expect(container).toBeTruthy();
  });
});
