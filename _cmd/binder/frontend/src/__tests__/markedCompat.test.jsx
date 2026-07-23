import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Marked from '@shared/editor/engines/Marked';

/**
 * marked プラグイン互換層（バージョンゲート・エラー隔離・binder コンテキスト注入）の
 * 振る舞いをバンドル marked 実体に対して検証する。
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const vendorPath = path.resolve(here, '../assets/vendor/marked.min.js');

// プラグインは文字列ソースとして applyPlugins に渡す（eval される）
const COMPAT_PLUGIN = `(function(){ return { extensions: [{
  name: 'compatTag', level: 'inline',
  start: function(s){ var m = s.match(/@@/); return m ? m.index : undefined; },
  tokenizer: function(s){ var m = s.match(/^@@([^@]+)@@/); if (m) return { type:'compatTag', raw:m[0], text:m[1] }; },
  renderer: function(t){ return '<compat>' + t.text + '</compat>'; }
}]}; })();`;

const THROWING_PLUGIN = `(function(){ return { extensions: [{
  name: 'boomTag', level: 'inline',
  start: function(s){ var m = s.match(/!!/); return m ? m.index : undefined; },
  tokenizer: function(s){ var m = s.match(/^!!([^!]+)!!/); if (m) return { type:'boomTag', raw:m[0], text:m[1] }; },
  renderer: function(){ throw new Error('boom'); }
}]}; })();`;

beforeAll(async () => {
  const mod = await import(pathToFileURL(vendorPath).href);
  globalThis.marked = mod;
  Marked.setVendorVersion('14.1.4');
});

beforeEach(() => {
  // marked.use() は共有インスタンスに蓄積するため、テストごとに拡張をクリアする。
  // globalThis.marked は消さず、登録済み extension のみデフォルトに戻す。
  globalThis.marked.marked.setOptions(globalThis.marked.marked.getDefaults());
});

async function parse(md) {
  return Marked.parse(md);
}

describe('marked plugin compat gate', () => {
  it('applies a plugin whose @marked range matches', async () => {
    const src = '/* @marked: >=14 <19 */\n' + COMPAT_PLUGIN;
    Marked.applyPlugins([{ name: 'compat', content: src }], { version: '14.1.4', major: 14, source: 'vendor' });
    const status = Marked.getPluginStatus().compat;
    expect(status.status).toBe('compatible');
    expect(status.applied).toBe(true);
    expect(await parse('x @@hi@@ y')).toContain('<compat>hi</compat>');
  });

  it('skips a plugin whose @marked range excludes the current version', async () => {
    const src = '/* @marked: >=17 */\n' + COMPAT_PLUGIN;
    Marked.applyPlugins([{ name: 'compat', content: src }], { version: '14.1.4', major: 14, source: 'vendor' });
    const status = Marked.getPluginStatus().compat;
    expect(status.status).toBe('incompatible');
    expect(status.applied).toBe(false);
    // スキップされたので記法は変換されない
    expect(await parse('x @@hi@@ y')).not.toContain('<compat>');
  });

  it('marks an undeclared plugin as undeclared but still applies it', async () => {
    Marked.applyPlugins([{ name: 'compat', content: COMPAT_PLUGIN }], { version: '14.1.4', major: 14, source: 'vendor' });
    const status = Marked.getPluginStatus().compat;
    expect(status.status).toBe('undeclared');
    expect(status.applied).toBe(true);
  });

  it('flags undeclared plugin as unverified when verified major differs', async () => {
    Marked.applyPlugins(
      [{ name: 'compat', content: COMPAT_PLUGIN }],
      { version: '18.0.7', major: 18, source: 'cdn' },
      { compat: 14 },
    );
    expect(Marked.getPluginStatus().compat.status).toBe('unverified');
  });
});

describe('marked plugin error isolation', () => {
  it('a throwing renderer does not crash the whole parse', async () => {
    const src = '/* @marked: >=14 <19 */\n' + THROWING_PLUGIN;
    Marked.applyPlugins([{ name: 'boom', content: src }], { version: '14.1.4', major: 14, source: 'vendor' });
    // 例外を投げるプラグインがあってもプレビュー全体は落ちない
    const out = await parse('before !!x!! after');
    expect(out).toContain('before');
    expect(out).toContain('after');
  });
});

describe('binder runtime context', () => {
  it('installs globalThis.binder with marked info and escape', () => {
    Marked.applyPlugins([], { version: '18.0.7', major: 18, source: 'cdn' });
    expect(globalThis.binder.marked.major).toBe(18);
    expect(globalThis.binder.marked.satisfies('>=17')).toBe(true);
    expect(globalThis.binder.marked.satisfies('<15')).toBe(false);
    expect(globalThis.binder.escape('a & <b> "c"')).toBe('a &amp; &lt;b&gt; &quot;c&quot;');
  });
});
