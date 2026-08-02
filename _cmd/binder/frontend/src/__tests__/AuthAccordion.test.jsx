import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../bindings/binder/api/app', () => ({
  GetUserInfo: vi.fn(() => Promise.resolve({})),
}));
vi.mock('../../bindings/main/window', () => ({
  SelectFileContent: vi.fn(() => Promise.resolve('')),
}));

import AuthAccordion from '../components/AuthAccordion';

describe('AuthAccordion', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <AuthAccordion onChange={() => {}} save={false} onSaveChange={() => {}} />
    );
    expect(container).toBeTruthy();
  });
});
