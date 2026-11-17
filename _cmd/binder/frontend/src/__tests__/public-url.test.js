import { describe, it, expect } from 'vitest';
import { publicPath } from '../public-url';

describe('publicPath', () => {
  it('builds the path for each kind', () => {
    expect(publicPath('note', 'memo', 'n1')).toBe('/pages/memo.html');
    expect(publicPath('diagram', 'fig')).toBe('/images/fig.svg');
    expect(publicPath('layer', 'lay')).toBe('/layers/lay.svg');
    expect(publicPath('asset', 'logo.png')).toBe('/assets/logo.png');
  });

  it('opens the index note at the site root', () => {
    expect(publicPath('note', 'index', 'index')).toBe('/');
    expect(publicPath('note', '', 'index')).toBe('/');
  });

  it('puts root aliases at the site root', () => {
    // 404 ページ（alias "/404"）は docs/404.html、ルートのアセット（"/robots.txt"）は docs/robots.txt
    expect(publicPath('note', '/404', 'n404')).toBe('/404.html');
    expect(publicPath('asset', '/robots.txt')).toBe('/robots.txt');
  });

  it('encodes characters that Browser.OpenURL rejects or misreads', () => {
    // 空白・全角スペース・<>・$ は Wails が拒否し、% は URL として読めず、# はフラグメントになる
    expect(publicPath('asset', 'my image.png')).toBe('/assets/my%20image.png');
    expect(publicPath('asset', '全角　空白.png')).toBe('/assets/%E5%85%A8%E8%A7%92%E3%80%80%E7%A9%BA%E7%99%BD.png');
    expect(publicPath('asset', 'a<b>.txt')).toBe('/assets/a%3Cb%3E.txt');
    expect(publicPath('asset', 'price$.csv')).toBe('/assets/price%24.csv');
    expect(publicPath('asset', '100%.txt')).toBe('/assets/100%25.txt');
    expect(publicPath('note', 'a#b', 'n1')).toBe('/pages/a%23b.html');
    expect(publicPath('layer', 'a b')).toBe('/layers/a%20b.svg');
  });

  it('returns an empty string when there is nothing to open', () => {
    expect(publicPath('asset', '')).toBe('');
    expect(publicPath('asset', '/')).toBe('');
    expect(publicPath('diagram', undefined)).toBe('');
    expect(publicPath('template', 'x')).toBe('');
  });
});
