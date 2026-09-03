import { describe, it, expect, vi, beforeEach } from 'vitest';

const resolveMock = vi.fn();
vi.mock('../../bindings/binder/api/app', () => ({
  ResolveBinderLink: (path) => resolveMock(path),
}));

const { toBinderPaths, resolveBinderLink } = await import('../components/editor/binder-link');

describe('toBinderPaths', () => {
  it('keeps an absolute binder path (both bases agree)', () => {
    expect(toBinderPaths('/pages/foo.html')).toEqual(['/pages/foo.html']);
  });

  it('offers both bases for a relative link', () => {
    // ../pages/x.html は通常のノート、./pages/x.html は index ノートの .Link
    expect(toBinderPaths('../pages/foo.html')).toContain('/pages/foo.html');
    expect(toBinderPaths('./pages/foo.html')).toContain('/pages/foo.html');
  });

  it('drops the query and the fragment', () => {
    expect(toBinderPaths('/pages/foo.html?a=1#sec')).toEqual(['/pages/foo.html']);
  });
});

describe('resolveBinderLink', () => {
  beforeEach(() => resolveMock.mockReset());

  it('returns the editor URL of the resolved note', async () => {
    resolveMock.mockResolvedValue({ id: 'note-1', type: 'note' });
    await expect(resolveBinderLink('/pages/foo.html')).resolves.toEqual({
      url: '/editor/note/note-1', id: 'note-1', typ: 'note',
    });
    expect(resolveMock).toHaveBeenCalledWith('/pages/foo.html');
  });

  it('uses the assets URL for an asset (the URL differs from the type)', async () => {
    resolveMock.mockResolvedValue({ id: 'a-1', type: 'asset' });
    await expect(resolveBinderLink('/assets/x.png')).resolves.toEqual({
      url: '/editor/assets/a-1', id: 'a-1', typ: 'asset',
    });
  });

  it('returns null for an unregistered alias', async () => {
    resolveMock.mockResolvedValue(null);
    await expect(resolveBinderLink('/pages/none.html')).resolves.toBeNull();
  });

  it('falls back to the docs root for an index note link', async () => {
    // index ノートの .Link は "./pages/x.html"。/pages/ 基準では解決できない
    resolveMock.mockImplementation((path) =>
      Promise.resolve(path === '/pages/foo.html' ? { id: 'note-1', type: 'note' } : null));

    await expect(resolveBinderLink('./pages/foo.html')).resolves.toEqual({
      url: '/editor/note/note-1', id: 'note-1', typ: 'note',
    });
    expect(resolveMock).toHaveBeenCalledWith('/pages/pages/foo.html');
    expect(resolveMock).toHaveBeenCalledWith('/pages/foo.html');
  });

  it('returns null for a type that has no editor screen', async () => {
    resolveMock.mockResolvedValue({ id: 't-1', type: 'template' });
    await expect(resolveBinderLink('/pages/foo.html')).resolves.toBeNull();
  });
});
