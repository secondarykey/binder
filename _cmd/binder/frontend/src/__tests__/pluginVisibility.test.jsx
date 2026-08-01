import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Marked from '@shared/editor/engines/Marked';

/**
 * 「プラグインが動いていないことにユーザが気付けるか」を担保するテスト。
 *
 * 互換層はプレビューを落とさないために失敗を握り潰すため、握り潰した事実が
 * getPluginWarnings() / 出力の見た目に必ず現れることを検証する。
 * ここが壊れると失敗が完全に不可視になり、劣化した HTML が記録されてしまう。
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const vendorPath = path.resolve(here, '../assets/vendor/marked.min.js');

const OK_PLUGIN = `(function(){ return { extensions: [{
  name: 'okTag', level: 'inline',
  start: function(s){ var m = s.match(/@@/); return m ? m.index : undefined; },
  tokenizer: function(s){ var m = s.match(/^@@([^@]+)@@/); if (m) return { type:'okTag', raw:m[0], text:m[1] }; },
  renderer: function(t){ return '<ok>' + t.text + '</ok>'; }
}]}; })();`;

// renderer だけが投げる（tokenizer は成功してトークンを作る）
const THROWING_RENDERER = `(function(){ return { extensions: [{
  name: 'boomTag', level: 'inline',
  start: function(s){ var m = s.match(/!!/); return m ? m.index : undefined; },
  tokenizer: function(s){ var m = s.match(/^!!([^!]+)!!/); if (m) return { type:'boomTag', raw:m[0], text:m[1] }; },
  renderer: function(){ throw new Error('boom'); }
}]}; })();`;

// eval 時点で落ちる
const BROKEN_PLUGIN = `(function(){ throw new Error('syntax-ish'); })();`;

// 何も返さない（marked.use() されない）
const EMPTY_PLUGIN = `(function(){ return null; })();`;

const VENDOR_INFO = { version: '14.1.4', major: 14, source: 'vendor' };

beforeAll(async () => {
  const mod = await import(pathToFileURL(vendorPath).href);
  globalThis.marked = mod;
  // reset() 後にエンジンだけ載せ直す状況を再現するため保持しておく
  globalThis.__markedModule = mod;
  Marked.setVendorVersion('14.1.4');
});

beforeEach(() => {
  globalThis.marked.marked.setOptions(globalThis.marked.marked.getDefaults());
});

describe('getPluginWarnings', () => {
  it('正常に適用されたプラグインでは警告を出さない', () => {
    Marked.applyPlugins([{ name: 'ok', content: OK_PLUGIN }], VENDOR_INFO);
    expect(Marked.getPluginWarnings()).toEqual([]);
  });

  it('読み込みに失敗したプラグインを名指しで警告する', () => {
    Marked.applyPlugins([{ name: 'broken', content: BROKEN_PLUGIN }], VENDOR_INFO);
    const warns = Marked.getPluginWarnings();
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('broken');
    expect(warns[0]).toContain('syntax-ish');
  });

  it('互換ゲートでスキップしたプラグインを警告する', () => {
    const src = '/* @marked: >=17 */\n' + OK_PLUGIN;
    Marked.applyPlugins([{ name: 'gated', content: src }], VENDOR_INFO);
    const warns = Marked.getPluginWarnings();
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('gated');
    expect(warns[0]).toContain('>=17');
  });

  it('拡張オブジェクトを返さないプラグインを未適用として警告する', () => {
    Marked.applyPlugins([{ name: 'empty', content: EMPTY_PLUGIN }], VENDOR_INFO);
    const warns = Marked.getPluginWarnings();
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('empty');
  });

  it('実行時例外は parse 後に警告として現れる', async () => {
    Marked.applyPlugins([{ name: 'boom', content: THROWING_RENDERER }], VENDOR_INFO);
    // parse するまでは renderer が呼ばれないので警告は無い
    expect(Marked.getPluginWarnings()).toEqual([]);

    await Marked.parse('before !!x!! after');

    const warns = Marked.getPluginWarnings();
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('boom');
  });

  it('翻訳関数が渡されればそれを使い、未定義キーは既定文言にフォールバックする', () => {
    Marked.applyPlugins([{ name: 'broken', content: BROKEN_PLUGIN }], VENDOR_INFO);

    const translated = Marked.getPluginWarnings((key, p) => `translated:${key}:${p.name}`);
    expect(translated[0]).toBe('translated:plugin.warn.loadError:broken');

    // i18next はキー未定義時にキーそのものを返す。その場合は既定文言に落とす
    const fallback = Marked.getPluginWarnings((key) => key);
    expect(fallback[0]).toContain('broken');
    expect(fallback[0]).not.toBe('plugin.warn.loadError');
  });

  it('エンジンを差し替えて再適用していない状態を検出する', () => {
    Marked.applyPlugins([{ name: 'ok', content: OK_PLUGIN }], VENDOR_INFO);
    expect(Marked.getPluginWarnings()).toEqual([]);

    // reset() は globalThis.marked を消すため、エンジン未ロード扱いになり警告は出ない
    Marked.reset();
    expect(Marked.getPluginWarnings()).toEqual([]);

    // エンジンだけ載せ直してプラグインを適用し忘れた状態（CDN差し替え時に起きうる）
    globalThis.marked = globalThis.__markedModule;
    const warns = Marked.getPluginWarnings();
    expect(warns).toHaveLength(1);
    expect(warns[0]).toMatch(/plugin/i);
  });
});

describe('renderer 失敗時のフォールバック', () => {
  it('記法を消さず元ソースをエスケープして残す（目視で気付けるようにする）', async () => {
    Marked.applyPlugins([{ name: 'boom', content: THROWING_RENDERER }], VENDOR_INFO);
    const out = await Marked.parse('before !!x & y!! after');

    expect(out).toContain('before');
    expect(out).toContain('after');
    // 空文字に潰さず、変換されなかったことが分かる生ソースを残す
    expect(out).toContain('!!x &amp; y!!');
  });
});

describe('getEngineWarnings', () => {
  // CDN 指定はバージョン固定の手段として使われるため、読めずにベンダー版へ落ちた
  // ことに気付けないと「固定したつもりで別バージョンが動く」状態になる
  const CDN = 'https://cdn.jsdelivr.net/npm/marked@14.1.4/lib/marked.esm.js';

  it('CDN 未指定なら警告しない', () => {
    Marked.setEngineRequest({ url: null });
    Marked.resolveMarkedInfo(null);
    expect(Marked.getEngineWarnings()).toEqual([]);
  });

  it('指定した CDN で動いていれば警告しない', () => {
    Marked.setEngineRequest({ url: CDN });
    Marked.resolveMarkedInfo(CDN);
    expect(Marked.getEngineWarnings()).toEqual([]);
  });

  it('指定したのにベンダー版で動いていれば警告する', () => {
    Marked.setEngineRequest({ url: CDN });
    Marked.resolveMarkedInfo(null); // 読み込み失敗 → ベンダーへフォールバック
    const warns = Marked.getEngineWarnings();
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain(CDN);
    expect(warns[0]).toContain('14.1.4');
  });

  it('許可CDN外で弾かれた場合は別の文言で警告する', () => {
    Marked.setEngineRequest({ url: 'https://evil.example.com/marked.esm.js', blocked: true });
    Marked.resolveMarkedInfo(null);
    const blocked = Marked.getEngineWarnings((key) => `k:${key}`);
    expect(blocked[0]).toBe('k:marked.warn.cdnBlocked');

    Marked.setEngineRequest({ url: CDN, blocked: false });
    Marked.resolveMarkedInfo(null);
    const fell = Marked.getEngineWarnings((key) => `k:${key}`);
    expect(fell[0]).toBe('k:marked.warn.cdnFallback');
  });

  it('getWarnings はエンジンとプラグインの警告を両方返す', () => {
    Marked.setEngineRequest({ url: CDN });
    Marked.resolveMarkedInfo(null);
    Marked.applyPlugins([{ name: 'broken', content: BROKEN_PLUGIN }], VENDOR_INFO);

    const all = Marked.getWarnings();
    expect(all).toHaveLength(2);
    expect(all[0]).toContain(CDN);
    expect(all[1]).toContain('broken');

    Marked.setEngineRequest({ url: null });
  });
});

describe('resolveMarkedInfo', () => {
  it('CDN URL の x.y.z を読み取る', () => {
    const info = Marked.resolveMarkedInfo('https://cdn.jsdelivr.net/npm/marked@18.0.7/lib/marked.esm.js');
    expect(info).toMatchObject({ version: '18.0.7', major: 18, source: 'cdn' });
  });

  it('パッチ以下を省いた URL でもメジャーを確定させる（version は不明のまま）', () => {
    const info = Marked.resolveMarkedInfo('https://cdn.jsdelivr.net/npm/marked@18/lib/marked.esm.js');
    expect(info).toMatchObject({ version: null, major: 18, source: 'cdn' });

    const minor = Marked.resolveMarkedInfo('https://cdn.jsdelivr.net/npm/marked@18.0/lib/marked.esm.js');
    expect(minor).toMatchObject({ version: null, major: 18, source: 'cdn' });
  });

  it('バンドル版はベンダー定数を使う', () => {
    const info = Marked.resolveMarkedInfo(null);
    expect(info).toMatchObject({ version: '14.1.4', major: 14, source: 'vendor' });
  });
});
