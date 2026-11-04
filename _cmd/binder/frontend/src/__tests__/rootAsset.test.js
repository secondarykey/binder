import { describe, it, expect } from 'vitest';
import {
  aliasName, isRootAlias, joinAlias, publishLocation, rootAssetWarnings,
} from '../dialogs/rootAsset';

describe('rootAsset', () => {
  it('isRootAlias / aliasName', () => {
    expect(isRootAlias('/robots.txt')).toBe(true);
    expect(isRootAlias('robots.txt')).toBe(false);
    expect(isRootAlias('')).toBe(false);
    expect(isRootAlias(undefined)).toBe(false);
    expect(aliasName('/robots.txt')).toBe('robots.txt');
    expect(aliasName('style.css')).toBe('style.css');
    expect(aliasName(undefined)).toBe('');
  });

  it('joinAlias', () => {
    expect(joinAlias('robots.txt', true)).toBe('/robots.txt');
    expect(joinAlias('robots.txt', false)).toBe('robots.txt');
    // 入力欄に "/" を打ってもルート扱い。二重にはしない
    expect(joinAlias('/robots.txt', true)).toBe('/robots.txt');
    expect(joinAlias('/robots.txt', false)).toBe('/robots.txt');
    expect(joinAlias('', true)).toBe('/');
  });

  it('publishLocation', () => {
    expect(publishLocation('', 'https://u.github.io/repo/')).toBe('');
    expect(publishLocation('/', 'https://u.github.io/repo/')).toBe('');
    expect(publishLocation('/robots.txt', 'https://u.github.io/repo/')).toBe('https://u.github.io/repo/robots.txt');
    expect(publishLocation('style.css', 'https://u.github.io/repo')).toBe('https://u.github.io/repo/assets/style.css');
    expect(publishLocation('/robots.txt', '')).toBe('docs/robots.txt');
    expect(publishLocation('style.css', '')).toBe('docs/assets/style.css');
  });

  describe('rootAssetWarnings', () => {
    const keys = (p) => rootAssetWarnings(p).map((w) => w.key);

    it('no warnings for assets under /assets/', () => {
      expect(keys({ alias: 'robots.txt', siteUrl: 'https://u.github.io/repo/' })).toEqual([]);
    });

    it('robots.txt on a project site', () => {
      const w = rootAssetWarnings({ alias: '/robots.txt', siteUrl: 'https://u.github.io/repo/' });
      expect(w).toEqual([{ key: 'asset.robotsIneffective', params: { url: 'https://u.github.io/repo/' } }]);
      expect(keys({ alias: '/ROBOTS.TXT', siteUrl: 'https://u.github.io/repo/' })).toEqual(['asset.robotsIneffective']);
    });

    it('robots.txt at the host root', () => {
      expect(keys({ alias: '/robots.txt', siteUrl: 'https://example.com/' })).toEqual([]);
      expect(keys({ alias: '/robots.txt', siteUrl: 'https://u.github.io/' })).toEqual([]);
    });

    it('unknown site URL does not warn', () => {
      expect(keys({ alias: '/robots.txt', siteUrl: '' })).toEqual([]);
      expect(keys({ alias: '/robots.txt', siteUrl: 'not a url' })).toEqual([]);
    });

    it('other root files are fine on a project site', () => {
      expect(keys({ alias: '/.nojekyll', siteUrl: 'https://u.github.io/repo/' })).toEqual([]);
    });

    it('published to a subdirectory', () => {
      const w = rootAssetWarnings({
        alias: '/.nojekyll', siteUrl: 'https://u.github.io/repo/en/', publishOnly: true, publishSubDir: '/en/',
      });
      expect(w).toEqual([{ key: 'asset.subDirIneffective', params: { dir: 'en' } }]);
      // サブディレクトリの警告が出るなら robots.txt の警告は重ねない
      expect(keys({
        alias: '/robots.txt', siteUrl: 'https://u.github.io/repo/en/', publishOnly: true, publishSubDir: 'en',
      })).toEqual(['asset.subDirIneffective']);
    });

    it('subdirectory is ignored unless only docs are sent', () => {
      expect(keys({ alias: '/.nojekyll', siteUrl: '', publishOnly: false, publishSubDir: 'en' })).toEqual([]);
    });
  });
});
