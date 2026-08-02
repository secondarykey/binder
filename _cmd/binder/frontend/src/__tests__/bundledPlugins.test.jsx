import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * 同梱 marked プラグインの回帰テスト。
 *
 * バンドルした marked（vendor）に対して setup/_assets/plugins/marked/ の全プラグインを
 * 適用し、ロードエラーが無いこと・エスケープ修正済みプラグインが特殊文字を
 * エスケープすることを検証する。marked のバンドル更新時にこのテストで
 * silent breakage を検出する。
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../../../');
const vendorPath = path.resolve(here, '../assets/vendor/marked.min.js');
const pluginDir = path.join(repoRoot, 'setup/_assets/plugins/marked');

let Marked;

beforeAll(async () => {
  const mod = await import(pathToFileURL(vendorPath).href);
  Marked = mod.Marked;
});

function loadPlugin(file) {
  const src = fs.readFileSync(path.join(pluginDir, file), 'utf8');
  // プラグインは IIFE で marked.use() 互換オブジェクトを返す
  return (0, eval)(src);
}

function renderWith(file, md) {
  const inst = new Marked();
  const ext = loadPlugin(file);
  if (ext && typeof ext === 'object') inst.use(ext);
  return inst.parse(md);
}

const allPlugins = fs
  .readdirSync(pluginDir)
  .filter((f) => f.endsWith('.js'))
  .sort();

describe('bundled marked plugins', () => {
  it('exposes the bundled Marked class', () => {
    expect(typeof Marked).toBe('function');
  });

  it('all bundled plugins are present', () => {
    // 15本（この数が変わったらテストのサンプルも見直す）
    expect(allPlugins.length).toBe(15);
  });

  it.each(allPlugins)('%s loads and renders without throwing', (file) => {
    expect(() => renderWith(file, '# Heading & <x>\n\npara `code & <b>` text\n')).not.toThrow();
  });

  // エスケープ修正済み（inline トークン委譲）プラグイン
  const escaped = [
    ['kbd.js', '[[Ctrl & C]]'],
    ['subscript.js', 'H~2 & x~'],
    ['superscript.js', 'x^2 & y^'],
    ['underline.js', '++a & b++'],
    ['highlight.js', '==a & b=='],
  ];

  it.each(escaped)('%s escapes bare ampersand in its content', (file, md) => {
    const out = renderWith(file, md);
    expect(out).toContain('&amp;');
    expect(out).not.toMatch(/[^;]& /); // 素の "& " が残っていない
  });

  it('kbd renders inline emphasis inside the tag', () => {
    const out = renderWith('kbd.js', '[[**Enter**]]');
    expect(out).toContain('<kbd><strong>Enter</strong></kbd>');
  });

  // marked 本体は版を公開していない（marked.version は v14〜v18 すべて undefined）ため、
  // marked-info は Binder が注入する globalThis.binder.marked を読む。
  // 注入経路が壊れると静かに "unknown" になるだけなので明示的に検証する。
  describe('marked-info の Version 行', () => {
    const versionRow = (html) => {
      const m = html.match(/<td[^>]*>Version<\/td><td[^>]*>(.*?)<\/td>/);
      return m ? m[1] : null;
    };

    afterEach(() => { delete globalThis.binder; });

    it('注入されたバージョンと取得元を出す', () => {
      globalThis.binder = { marked: { version: '17.0.5', major: 17, source: 'vendor' } };
      const row = versionRow(renderWith('marked-info.js', '@info\n'));
      expect(row).toContain('17.0.5');
      expect(row).toContain('vendor');
    });

    // CDN で "marked@18" のようにパッチを省いた指定はメジャーしか確定しない
    it('パッチ不明ならメジャーのみを x 付きで出す', () => {
      globalThis.binder = { marked: { version: null, major: 18, source: 'cdn' } };
      const row = versionRow(renderWith('marked-info.js', '@info\n'));
      expect(row).toContain('18.x');
      expect(row).toContain('cdn');
    });

    // Binder 外（コンテキスト注入なし）でも例外にせず unknown に落とす
    it('コンテキストが無ければ unknown に落とす', () => {
      const row = versionRow(renderWith('marked-info.js', '@info\n'));
      expect(row).toContain('unknown');
    });
  });
});
