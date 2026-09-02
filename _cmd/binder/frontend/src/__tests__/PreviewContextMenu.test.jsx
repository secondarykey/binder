import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PreviewContextMenu from '@shared/editor/PreviewContextMenu';

// テスト用 i18n には翻訳を積んでいないため、キーがそのまま描画される
const COPY = 'preview.contextMenu.copy';
const COPY_LINK = 'preview.contextMenu.copyLink';
const OPEN_BROWSER = 'preview.contextMenu.openInBrowser';
const OPEN_ENTRY = 'preview.contextMenu.openEntry';
const BACK = 'editor.historyBack';
const FORWARD = 'editor.historyForward';

function setup(state, handlers = {}) {
  const props = {
    state: { open: true, x: 0, y: 0, kind: null, href: '', selection: '', ...state },
    onClose: vi.fn(),
    onBack: vi.fn(),
    onForward: vi.fn(),
    onCopy: vi.fn(),
    onCopyLink: vi.fn(),
    onOpenExternal: vi.fn(),
    onOpenInternal: vi.fn(),
    ...handlers,
  };
  render(<PreviewContextMenu {...props} />);
  return props;
}

describe('PreviewContextMenu', () => {
  it('renders nothing while closed', () => {
    setup({ open: false });
    expect(screen.queryByText(COPY)).toBeNull();
  });

  it('shows copy disabled when nothing is selected', () => {
    setup({});
    expect(screen.getByText(COPY).closest('li')).toHaveAttribute('aria-disabled', 'true');
    // リンク上でなければリンク項目は出さない
    expect(screen.queryByText(COPY_LINK)).toBeNull();
    expect(screen.queryByText(OPEN_BROWSER)).toBeNull();
    expect(screen.queryByText(OPEN_ENTRY)).toBeNull();
  });

  it('copies the selection', async () => {
    const props = setup({ selection: 'selected text' });
    await userEvent.click(screen.getByText(COPY));
    expect(props.onCopy).toHaveBeenCalledWith('selected text');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('offers browser open and link copy on an external link', async () => {
    const props = setup({ kind: 'external', href: 'https://example.com/' });
    expect(screen.queryByText(OPEN_ENTRY)).toBeNull();

    await userEvent.click(screen.getByText(OPEN_BROWSER));
    expect(props.onOpenExternal).toHaveBeenCalledWith('https://example.com/');

    await userEvent.click(screen.getByText(COPY_LINK));
    expect(props.onCopyLink).toHaveBeenCalledWith('https://example.com/');
  });

  it('offers opening the entry on a binder link', async () => {
    const props = setup({ kind: 'internal', href: '../pages/a.html' });
    expect(screen.queryByText(OPEN_BROWSER)).toBeNull();

    await userEvent.click(screen.getByText(OPEN_ENTRY));
    expect(props.onOpenInternal).toHaveBeenCalledWith('../pages/a.html');
  });

  it('hides handlers the app does not provide (Lite has no binder links)', () => {
    setup({ kind: 'internal', href: '../pages/a.html' }, { onOpenInternal: undefined });
    expect(screen.queryByText(OPEN_ENTRY)).toBeNull();
  });

  it('goes back through the editor history, not the frame history', async () => {
    const props = setup({ canBack: true });
    await userEvent.click(screen.getByText(BACK));
    expect(props.onBack).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('disables back and forward when the history has nowhere to go', () => {
    setup({ canBack: false, canForward: false });
    expect(screen.getByText(BACK).closest('li')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(FORWARD).closest('li')).toHaveAttribute('aria-disabled', 'true');
  });

  it('hides history items where there is no editor (Lite)', () => {
    setup({ canBack: true }, { onBack: undefined, onForward: undefined });
    expect(screen.queryByText(BACK)).toBeNull();
    expect(screen.queryByText(FORWARD)).toBeNull();
  });

  it('offers no link items on an in-page anchor', () => {
    setup({ kind: 'anchor', href: '#sec', selection: 'x' });
    expect(screen.getByText(COPY)).toBeInTheDocument();
    expect(screen.queryByText(COPY_LINK)).toBeNull();
    expect(screen.queryByText(OPEN_BROWSER)).toBeNull();
    expect(screen.queryByText(OPEN_ENTRY)).toBeNull();
  });
});
