import { describe, it, expect, vi, beforeEach } from 'vitest';

const resolveMock = vi.fn();
vi.mock('../../bindings/binder/api/app', () => ({
  ResolveBinderLink: (path) => resolveMock(path),
}));

const { toBinderPath, resolveBinderLink } = await import('../components/editor/binder-link');

describe('toBinderPath', () => {
  it('keeps an absolute binder path', () => {
    expect(toBinderPath('/pages/foo.html')).toBe('/pages/foo.html');
  });

  it('resolves a relative link against /pages/', () => {
    expect(toBinderPath('foo.html')).toBe('/pages/foo.html');
    expect(toBinderPath('../images/bar.svg')).toBe('/images/bar.svg');
  });

  it('drops the query and the fragment', () => {
    expect(toBinderPath('/pages/foo.html?a=1#sec')).toBe('/pages/foo.html');
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

  it('returns null for a type that has no editor screen', async () => {
    resolveMock.mockResolvedValue({ id: 't-1', type: 'template' });
    await expect(resolveBinderLink('/pages/foo.html')).resolves.toBeNull();
  });
});
