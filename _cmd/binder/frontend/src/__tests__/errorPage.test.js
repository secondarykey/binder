import { describe, it, expect } from 'vitest';
import {
  ERROR_PAGE_ALIAS, errorPageWarnings, isErrorPageAlias, toggleErrorPageAlias,
} from '../dialogs/errorPage';

describe('errorPage', () => {
  it('isErrorPageAlias', () => {
    expect(isErrorPageAlias('/404')).toBe(true);
    expect(isErrorPageAlias('404')).toBe(false);
    expect(isErrorPageAlias('/robots')).toBe(false);
    expect(isErrorPageAlias(undefined)).toBe(false);
  });

  it('toggleErrorPageAlias', () => {
    expect(toggleErrorPageAlias(true, { alias: 'about', previous: 'about', id: 'n1' })).toBe(ERROR_PAGE_ALIAS);
    // 外すと開いた時点の alias に戻す
    expect(toggleErrorPageAlias(false, { alias: '/404', previous: 'about', id: 'n1' })).toBe('about');
    // 開いた時点で 404 ページだったら ID（新規作成時の alias）に戻す
    expect(toggleErrorPageAlias(false, { alias: '/404', previous: '/404', id: 'n1' })).toBe('n1');
    expect(toggleErrorPageAlias(false, { alias: '/404', previous: '', id: 'n1' })).toBe('n1');
    // 404 ページでなければ変えない
    expect(toggleErrorPageAlias(false, { alias: 'about', previous: 'x', id: 'n1' })).toBe('about');
  });

  describe('errorPageWarnings', () => {
    const keys = (p) => errorPageWarnings(p).map((w) => w.key);

    it('no warnings with a site URL', () => {
      expect(keys({ siteUrl: 'https://u.github.io/repo/' })).toEqual([]);
    });

    it('unknown site URL', () => {
      expect(keys({ siteUrl: '' })).toEqual(['note.errorPageNoSiteUrl']);
    });

    it('published to a subdirectory', () => {
      expect(errorPageWarnings({ siteUrl: 'https://u.github.io/repo/en/', publishOnly: true, publishSubDir: 'en/' }))
        .toEqual([{ key: 'note.errorPageSubDir', params: { dir: 'en' } }]);
      // サブディレクトリの設定は docs だけを送るときだけ効く
      expect(keys({ siteUrl: 'https://u.github.io/repo/', publishOnly: false, publishSubDir: 'en' })).toEqual([]);
    });
  });
});
