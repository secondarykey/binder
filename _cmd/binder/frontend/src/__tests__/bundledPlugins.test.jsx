import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parsePluginMeta } from '@shared/editor/pluginMeta';

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

  // 設定画面がメタ列（表示名 / バージョン / 対応marked）を埋められる状態を保つ。
  // 宣言が無いと "-" 表示になり、同梱版なのに素性が分からないプラグインができる
  it.each(allPlugins)('%s declares name / version / marked range', (file) => {
    const meta = parsePluginMeta(fs.readFileSync(path.join(pluginDir, file), 'utf8'));
    expect(meta.name).toBeTruthy();
    expect(meta.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(meta.marked).toBeTruthy();
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

  // smartypants は hooks.preprocess で本文全体を書き換えるため、生 HTML の
  // 属性値まで巻き込むと描画が壊れる。drawLayer（html_func.go）が出力する SVG が
  // viewBox=”0 0 1.5 1” になり "Expected number" で描画に失敗していた。
  describe('smartypants と生 HTML', () => {
    it('タグの属性値のクォートを変換しない', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1.5 1" preserveAspectRatio="none"></svg>';
      const out = renderWith('smartypants.js', svg);
      expect(out).toContain('viewBox="0 0 1.5 1"');
      expect(out).not.toContain('”');
    });

    // 同じ理由で style 属性の var(--x) がエンダッシュ化していた
    it('属性値の CSS カスタムプロパティをエンダッシュにしない', () => {
      const out = renderWith('smartypants.js', '<div style="color:var(--text-primary)">a</div>');
      expect(out).toContain('var(--text-primary)');
    });

    it('タグの中身のテキストは従来どおり変換する', () => {
      const out = renderWith('smartypants.js', '<div>He said "hi"</div>');
      expect(out).toContain('“hi”');
    });

    // 区切り行の --- がエムダッシュに化けると marked がテーブルと認識できず、
    // 表全体が段落として出力されていた
    it('テーブルの区切り行を変換せず表として描画する', () => {
      const md = [
        '| Left align | Right align | Center align |',
        '|:-----------|------------:|:------------:|',
        '| This       | This        | This         |',
        '',
      ].join('\n');
      const out = renderWith('smartypants.js', md);
      expect(out).toContain('<table>');
      expect(out).toContain('<th align="left">Left align</th>');
      expect(out).toContain('<th align="right">Right align</th>');
      expect(out).toContain('<th align="center">Center align</th>');
    });

    // パイプ無しの区切り行・CRLF の本文でも同じく表になる
    it.each([
      ['パイプ省略', 'A | B\n--- | ---\n1 | 2\n'],
      ['CRLF', '| A | B |\r\n|:--|--:|\r\n| 1 | 2 |\r\n'],
    ])('テーブルの区切り行を変換しない（%s）', (_label, md) => {
      expect(renderWith('smartypants.js', md)).toContain('<table>');
    });

    it('テーブルのセル本文は従来どおり変換する', () => {
      const out = renderWith('smartypants.js', '| A |\n|---|\n| He said "hi" -- ok... |\n');
      expect(out).toContain('<td>He said “hi” – ok…</td>');
    });

    // 区切り行の保護が水平線・setext 見出しを巻き込んでいないこと
    it('水平線と setext 見出しは従来どおり', () => {
      expect(renderWith('smartypants.js', 'para\n\n---\n\npara2\n')).toContain('<hr>');
      expect(renderWith('smartypants.js', 'Title\n---\n')).toContain('<h2>Title</h2>');
    });

    it('通常の文章は従来どおり変換する', () => {
      const out = renderWith('smartypants.js', 'He said "hello" -- it\'s fine...');
      expect(out).toContain('“hello”');
      expect(out).toContain('–');
      expect(out).toContain('…');
      expect(out).toContain('it’s');
    });
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
