import { describe, it, expect, vi } from 'vitest';
import { createContext } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../dialogs/components/DialogError', () => ({
  DialogErrorContext: createContext(null),
}));

import ModalWrapper from '../dialogs/components/ModalWrapper';

describe('ModalWrapper', () => {
  it('renders title and children when open', () => {
    render(
      <ModalWrapper open={true} onClose={() => {}} title="Test Modal">
        <div>Modal Content</div>
      </ModalWrapper>
    );
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <ModalWrapper open={false} onClose={() => {}} title="Test Modal">
        <div>Modal Content</div>
      </ModalWrapper>
    );
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
  });

  it('renders close button', () => {
    render(
      <ModalWrapper open={true} onClose={() => {}} title="Test Modal">
        <div>content</div>
      </ModalWrapper>
    );
    expect(screen.getByLabelText('close')).toBeInTheDocument();
  });
});
