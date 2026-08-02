import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * 起動時のエンジン初期化。
 *
 * marked / mermaid の CDN URL はバインダー設定（binder.json）にあるため、
 * バインダー未オープン時に内蔵版で初期化を確定させてしまうと、その後
 * バインダーを開いても CDN 指定が効かなくなる（marked は isExists()、
 * mermaid は globalThis.mermaid の存在チェックで以降の init が素通りする）。
 *
 * 「起動時にバインダーを開く」ではウォームアップが LoadBinder 完了前に走るため、
 * この経路が必ず通る。ここが壊れると起動のたびに内蔵版へ落ちる。
 */

const getConfig = vi.fn();
const getAllowedCDNs = vi.fn(() => Promise.resolve(['cdn.jsdelivr.net']));

vi.mock('../../bindings/binder/api/app', () => ({
  GetConfig: vi.fn(() => getConfig()),
  GetAllowedCDNs: vi.fn(() => getAllowedCDNs()),
  GetPlugins: vi.fn(() => Promise.resolve([])),
  GetPluginVerifiedMajors: vi.fn(() => Promise.resolve({})),
}));

import Marked from '@shared/editor/engines/Marked';
import { initMarked, initMermaid, installEngineInit } from '../engineInit';

const CDN = 'https://cdn.jsdelivr.net/npm/marked@18.0.7/lib/marked.esm.js';

describe('engineInit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getConfig.mockReset();
    delete globalThis.mermaid;
    Marked.setEngineRequest({ url: null, blocked: false });
  });

  afterEach(() => {
    delete globalThis.mermaid;
  });

  describe('initMarked', () => {
    it('バインダー未オープンならエンジンを載せずに見送る', async () => {
      // GetConfig はバインダー未オープン時 null を返す（エラーではない）
      getConfig.mockResolvedValue(null);
      const origInit = vi.fn(() => Promise.resolve());
      const tryLoadUrl = vi.spyOn(Marked, 'tryLoadUrl');

      const done = await initMarked(origInit);

      expect(done).toBe(false);
      // 内蔵版も CDN も読み込まない。エンジンは未ロードのまま次の機会に委ねる
      expect(origInit).not.toHaveBeenCalled();
      expect(tryLoadUrl).not.toHaveBeenCalled();
    });

    // 見送った時に要求 URL を記録すると、実際には何も要求していないのに
    // 「CDN を読もうとして失敗した」と警告されてしまう
    it('見送った時は要求 URL を記録しない', async () => {
      getConfig.mockResolvedValue(null);
      await initMarked(vi.fn(() => Promise.resolve()));

      expect(Marked.getEngineWarnings()).toEqual([]);
    });

    it('バインダーが開いていれば CDN を読む', async () => {
      getConfig.mockResolvedValue({ markedUrl: CDN });
      const origInit = vi.fn(() => Promise.resolve());
      const tryLoadUrl = vi.spyOn(Marked, 'tryLoadUrl').mockResolvedValue(true);

      const done = await initMarked(origInit);

      expect(done).toBe(true);
      expect(tryLoadUrl).toHaveBeenCalledWith(CDN);
      expect(origInit).not.toHaveBeenCalled();
    });

    it('CDN の読み込みに失敗したら内蔵版へ落とす', async () => {
      getConfig.mockResolvedValue({ markedUrl: CDN });
      const origInit = vi.fn(() => Promise.resolve());
      vi.spyOn(Marked, 'tryLoadUrl').mockResolvedValue(false);

      expect(await initMarked(origInit)).toBe(true);
      expect(origInit).toHaveBeenCalled();
    });

    it('markedUrl 未設定なら内蔵版で初期化する', async () => {
      getConfig.mockResolvedValue({ markedUrl: '' });
      const origInit = vi.fn(() => Promise.resolve());
      const tryLoadUrl = vi.spyOn(Marked, 'tryLoadUrl');

      expect(await initMarked(origInit)).toBe(true);
      expect(tryLoadUrl).not.toHaveBeenCalled();
      expect(origInit).toHaveBeenCalled();
    });

    it('許可 CDN 一覧に無い URL は内蔵版へ落とす', async () => {
      getConfig.mockResolvedValue({ markedUrl: 'https://evil.example.com/marked.esm.js' });
      const origInit = vi.fn(() => Promise.resolve());
      const tryLoadUrl = vi.spyOn(Marked, 'tryLoadUrl');

      expect(await initMarked(origInit)).toBe(true);
      expect(tryLoadUrl).not.toHaveBeenCalled();
      expect(origInit).toHaveBeenCalled();
    });
  });

  // 報告された不具合の再現。「起動時にバインダーを開く」では
  //   1. ウォームアップの ensureInit（この時点ではバインダー未オープン）
  //   2. LoadBinder 完了後の ensureInit
  // の順に呼ばれる。1 で内蔵版を確定させると 2 が素通りし、CDN 指定が
  // アプリを再起動するまで一切効かなくなっていた。
  describe('起動時のウォームアップ → バインダーオープンの順序', () => {
    it('ウォームアップが先行しても、開いた後の ensureInit で CDN を読む', async () => {
      installEngineInit();
      delete globalThis.marked;

      const tryLoadUrl = vi.spyOn(Marked, 'tryLoadUrl').mockImplementation(async () => {
        globalThis.marked = { marked: () => '' };
        return true;
      });

      // 1. ウォームアップ: バインダーはまだ開いていない
      getConfig.mockResolvedValue(null);
      await Marked.ensureInit();

      // 内蔵版を載せて確定させていないこと（載せると次が素通りする）
      expect(Marked.isExists()).toBe(false);
      expect(tryLoadUrl).not.toHaveBeenCalled();

      // 2. LoadBinder 完了後
      getConfig.mockResolvedValue({ markedUrl: CDN });
      await Marked.ensureInit();

      expect(tryLoadUrl).toHaveBeenCalledWith(CDN);
      expect(Marked.getMarkedInfo().source).toBe('cdn');

      delete globalThis.marked;
    });
  });

  describe('initMermaid', () => {
    it('バインダー未オープンならエンジンを載せずに見送る', async () => {
      getConfig.mockResolvedValue(null);
      const origInit = vi.fn(() => Promise.resolve());

      expect(await initMermaid(origInit)).toBe(false);
      expect(origInit).not.toHaveBeenCalled();
    });

    it('バインダーが開いていれば設定の URL で初期化する', async () => {
      const url = 'https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs';
      getConfig.mockResolvedValue({ mermaidUrl: url });
      const origInit = vi.fn(() => Promise.resolve());

      expect(await initMermaid(origInit)).toBe(true);
      expect(origInit).toHaveBeenCalledWith(url, undefined);
    });

    // URL 明示時は呼び出し元が決めているのでバインダー設定を見ない
    it('URL 明示時はバインダー未オープンでも初期化する', async () => {
      getConfig.mockResolvedValue(null);
      const origInit = vi.fn(() => Promise.resolve());

      expect(await initMermaid(origInit, 'https://cdn.jsdelivr.net/x.mjs')).toBe(true);
      expect(origInit).toHaveBeenCalled();
      expect(getConfig).not.toHaveBeenCalled();
    });
  });
});
