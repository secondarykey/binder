import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../bindings/main/window', () => ({
  SelectFileContent: vi.fn(() => Promise.resolve('')),
}));

import AuthFields from '../components/AuthFields';

describe('AuthFields', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <AuthFields
        authType="basic"
        onAuthTypeChange={() => {}}
        username=""
        onUsernameChange={() => {}}
        password=""
        onPasswordChange={() => {}}
        token=""
        onTokenChange={() => {}}
        passphrase=""
        onPassphraseChange={() => {}}
        sshKey=""
        onSSHKeyChange={() => {}}
      />
    );
    expect(container).toBeTruthy();
  });
});
