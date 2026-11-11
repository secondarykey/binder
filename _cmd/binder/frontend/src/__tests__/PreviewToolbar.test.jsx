import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';

import PreviewToolbar from '../components/editor/PreviewToolbar';
import ParseStatusBar, { ParseDialogs } from '../components/editor/ParseStatusBar';

function setup(overrides = {}) {
  const props = {
    isNote: true, isTemplate: false, templateType: '',
    previewDiagrams: [{ id: 'd1', name: 'Diagram 1' }], previewDiagramId: 'd1', onPreviewDiagramChange: vi.fn(),
    previewOtherTemplates: [{ id: 't1', name: 'Template 1' }], previewOtherTemplateId: 't1', onPreviewOtherTemplateChange: vi.fn(),
    previewNotes: [{ id: 'n1', name: 'Note 1' }], previewNoteId: 'n1', onPreviewNoteChange: vi.fn(),
    scriptsBlocked: false, onScriptsBlockedClick: vi.fn(),
    colorSchemeConfig: null, colorSchemeIndex: 0, onNextColorScheme: vi.fn(),
    onDownload: vi.fn(), onDownloadZip: vi.fn(),
    onOpenPreviewWindow: vi.fn(),
    onPublish: vi.fn(), publishDisabled: false,
    onOpenInBrowser: vi.fn(), openInBrowserDisabled: false,
    onUnpublish: vi.fn(),
    ...overrides,
  };
  const utils = render(<PreviewToolbar {...props} />);
  return { props, ...utils };
}

const button = (container, label) => container.querySelector(`button[aria-label="${label}"]`);
// 「その他」は aria-label を持たない最後のボタン
const moreButton = (container) => {
  const all = container.querySelectorAll('.previewMenuRight button');
  return all[all.length - 1];
};

describe('PreviewToolbar', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('ノートではダウンロード 2 種とその他メニューを出す', () => {
    const { props, container } = setup();
    fireEvent.click(button(container, 'download'));
    fireEvent.click(button(container, 'download-zip'));
    expect(props.onDownload).toHaveBeenCalled();
    expect(props.onDownloadZip).toHaveBeenCalled();

    fireEvent.click(moreButton(container));
    fireEvent.click(screen.getByText('preview.publish'));
    expect(props.onPublish).toHaveBeenCalled();

    fireEvent.click(moreButton(container));
    fireEvent.click(screen.getByText('preview.unpublish'));
    expect(props.onUnpublish).toHaveBeenCalled();

    fireEvent.click(moreButton(container));
    fireEvent.click(screen.getByText('preview.openPreviewWindow'));
    expect(props.onOpenPreviewWindow).toHaveBeenCalled();
  });

  it('公開とブラウザで開くは、指定されたら押せない', () => {
    const { props, container } = setup({ publishDisabled: true, openInBrowserDisabled: true });
    fireEvent.click(moreButton(container));
    expect(screen.getByText('preview.publish').closest('li').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('tree.openBrowser').closest('li').getAttribute('aria-disabled')).toBe('true');
    expect(props.onPublish).not.toHaveBeenCalled();
  });

  it('ダイアグラムでは ZIP を出さない', () => {
    const { container } = setup({ isNote: false });
    expect(button(container, 'download')).toBeTruthy();
    expect(button(container, 'download-zip')).toBeNull();
  });

  it('テンプレートではダウンロードもその他も出さず、相手のテンプレートとノートを選ばせる', () => {
    const { container } = setup({ isNote: false, isTemplate: true, templateType: 'layout' });
    expect(button(container, 'download')).toBeNull();
    expect(container.querySelectorAll('.previewMenuRight button').length).toBe(0);
    const left = container.querySelector('.previewMenuLeft');
    expect(left.textContent).toContain('Template 1');
    expect(left.textContent).toContain('Note 1');
    expect(left.textContent).not.toContain('Diagram 1');
  });

  it('ダイアグラムのテンプレートではダイアグラムを選ばせる', () => {
    const { container } = setup({ isNote: false, isTemplate: true, templateType: 'diagram' });
    const left = container.querySelector('.previewMenuLeft');
    expect(left.textContent).toContain('Diagram 1');
    expect(left.textContent).not.toContain('Note 1');
  });

  it('スクリプトを止めた印はノートと HTML のテンプレートだけに出す', () => {
    expect(button(setup({ scriptsBlocked: true }).container, 'scripts-blocked')).toBeTruthy();
    expect(button(setup({ scriptsBlocked: true, isNote: false }).container, 'scripts-blocked')).toBeNull();
    expect(button(setup({ scriptsBlocked: true, isNote: false, isTemplate: true, templateType: 'content' }).container, 'scripts-blocked')).toBeTruthy();
    expect(button(setup({ scriptsBlocked: true, isNote: false, isTemplate: true, templateType: 'diagram' }).container, 'scripts-blocked')).toBeNull();
  });

  it('カラースキームは設定があるときだけ切り替えを出す', () => {
    expect(button(setup().container, 'color-scheme')).toBeNull();
    const { props, container } = setup({ colorSchemeConfig: { attribute: 'data-theme', values: ['light', 'dark'] } });
    fireEvent.click(button(container, 'color-scheme'));
    expect(props.onNextColorScheme).toHaveBeenCalled();
  });
});

describe('ParseStatusBar', () => {
  const base = { selectionChars: 0, totalChars: 1234, saveState: null, onShowError: vi.fn(), onShowWarnings: vi.fn() };

  it('状態ごとの表示を出す', () => {
    const { container, rerender } = render(<ParseStatusBar {...base} parseStatus={{ status: 'success', err: null, warnings: [], ms: 12 }} />);
    expect(container.textContent).toContain('Success (12ms)');
    rerender(<ParseStatusBar {...base} parseStatus={{ status: 'processing', err: null, warnings: [] }} />);
    expect(container.textContent).toContain('Processing...');
    rerender(<ParseStatusBar {...base} parseStatus={{ status: 'warning', err: null, warnings: ['a', 'b'] }} />);
    expect(container.textContent).toContain('Warning (2)');
    rerender(<ParseStatusBar {...base} parseStatus={{ status: 'error', err: 'boom', warnings: [] }} />);
    expect(container.textContent).toContain('preview.parseError');
  });

  it('ダブルクリックで、エラーがあればエラーを、無ければ警告を開く', () => {
    const onShowError = vi.fn();
    const onShowWarnings = vi.fn();
    const { container, rerender } = render(<ParseStatusBar {...base} onShowError={onShowError} onShowWarnings={onShowWarnings} parseStatus={{ status: 'error', err: 'boom', warnings: ['w'] }} />);
    fireEvent.doubleClick(container.querySelector('.parseStatusLeft'));
    expect(onShowError).toHaveBeenCalledTimes(1);
    expect(onShowWarnings).not.toHaveBeenCalled();

    rerender(<ParseStatusBar {...base} onShowError={onShowError} onShowWarnings={onShowWarnings} parseStatus={{ status: 'warning', err: null, warnings: ['w'] }} />);
    fireEvent.doubleClick(container.querySelector('.parseStatusLeft'));
    expect(onShowWarnings).toHaveBeenCalledTimes(1);

    rerender(<ParseStatusBar {...base} onShowError={onShowError} onShowWarnings={onShowWarnings} parseStatus={{ status: 'success', err: null, warnings: [] }} />);
    fireEvent.doubleClick(container.querySelector('.parseStatusLeft'));
    expect(onShowError).toHaveBeenCalledTimes(1);
    expect(onShowWarnings).toHaveBeenCalledTimes(1);
  });

  it('保存に失敗したときは見分けられるクラスを付ける', () => {
    const ok = { status: 'success', err: null, warnings: [] };
    const { container, rerender } = render(<ParseStatusBar {...base} parseStatus={ok} />);
    expect(container.querySelector('.saveState')).toBeNull();
    rerender(<ParseStatusBar {...base} parseStatus={ok} saveState="saved" />);
    expect(container.querySelector('.saveState').classList.contains('saveStateError')).toBe(false);
    rerender(<ParseStatusBar {...base} parseStatus={ok} saveState="error" />);
    expect(container.querySelector('.saveState').classList.contains('saveStateError')).toBe(true);
  });
});

describe('ParseDialogs', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('エラーと警告の中身を出し、閉じるを返す', () => {
    const onCloseError = vi.fn();
    const status = { status: 'error', err: 'boom', warnings: ['warn 1', 'warn 2'] };
    const { rerender } = render(<ParseDialogs parseStatus={status} errorOpen warningOpen={false} onCloseError={onCloseError} onCloseWarning={vi.fn()} />);
    expect(screen.getByText('boom')).toBeTruthy();
    expect(screen.queryByText('warn 1')).toBeNull();
    // 閉じるボタン（ActionButton はラベルを文字として出さない）
    fireEvent.click(document.querySelector('.MuiDialogActions-root button'));
    expect(onCloseError).toHaveBeenCalled();

    rerender(<ParseDialogs parseStatus={status} errorOpen={false} warningOpen onCloseError={onCloseError} onCloseWarning={vi.fn()} />);
    expect(screen.getByText('warn 1')).toBeTruthy();
    expect(screen.getByText('Warnings (2)')).toBeTruthy();
  });
});
