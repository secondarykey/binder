import Scripter from "./Scripter";

const Name = "mermaid";
const DefaultOpts = { startOnLoad: false };

// ダイアグラムスタイルテンプレートのキャッシュ（テンプレートID → 内容文字列）
const _styleCache = {};

// レンダリング済み SVG のキャッシュ（テキスト全文 → mermaid.render の結果）。
// プレビュー更新のたびに変更のない図まで再レンダリングされるのを防ぐ。
// スタイルテンプレートの内容は fullTxt（キー）に含まれるため個別の無効化は不要。
// initialize（テーマ等）が変わると同じテキストでも結果が変わるため世代番号で無効化する
const _svgCache = new Map();
const SVG_CACHE_LIMIT = 50;
let _generation = 0;

function invalidateSvgCache() {
  _generation++;
  _svgCache.clear();
}

/**
 * mermaid を利用してパースするクラス
 *
 * ベンダー URL は setVendorUrl() で設定する。
 * CDN対応等の拡張は各アプリ側のラッパーで行う。
 */
class MermaidScript {

  static _vendorUrl = null;

  /**
   * ベンダー JS の URL を設定する（アプリ起動時に一度呼ぶ）
   */
  static setVendorUrl(url) {
    MermaidScript._vendorUrl = url;
  }

  static isExists() {
    return Scripter.isExists(Name)
  }

  static reset() {
    delete globalThis.mermaid;
    invalidateSvgCache();
  }

  /**
   * ベンダー版で初期化する。
   * @param {string} [url] CDN URL（省略時はベンダー版）
   * @param {object} [opts] mermaid.initialize に渡すオプション
   */
  static async init(url, opts) {
    if (globalThis.mermaid !== undefined) {
      return;
    }

    var mermaid = null;
    if (url) {
      mermaid = await MermaidScript.tryLoadUrl(url);
      if (!mermaid) {
        console.warn("CDN URL failed, falling back to vendor");
      }
    }
    if (!mermaid) {
      mermaid = await Scripter.loadScript(MermaidScript._vendorUrl, Name);
    }

    mermaid.initialize(opts || DefaultOpts);
    globalThis.mermaid = mermaid;
    invalidateSvgCache();
  }

  /**
   * URLからmermaidを読み込む（ESM → UMD の順に試行）
   * @param {string} url
   * @returns {object|null} mermaidインスタンス。失敗時null
   */
  static async tryLoadUrl(url) {
    try {
      var m = await Scripter.import(url);
      return m.default;
    } catch (esmErr) {
      try {
        return await Scripter.loadScript(url, Name);
      } catch (umdErr) {
        return null;
      }
    }
  }

  /**
   * 指定URLでmermaidを読み込み、失敗時はベンダー版にフォールバック。
   * @param {string} url
   * @returns {{ success: boolean }}
   */
  static async loadAndValidate(url) {
    delete globalThis.mermaid;

    var mermaid = null;
    if (url) {
      mermaid = await MermaidScript.tryLoadUrl(url);
    }
    var success = (mermaid !== null);
    if (!mermaid) {
      mermaid = await Scripter.loadScript(MermaidScript._vendorUrl, Name);
    }
    mermaid.initialize(DefaultOpts);
    globalThis.mermaid = mermaid;
    invalidateSvgCache();
    return { success };
  }

  /**
   * スタイルテンプレートをキャッシュに設定する
   */
  static setStyleTemplate(id, content) {
    if (id) _styleCache[id] = content;
  }

  /**
   * キャッシュからスタイルテンプレート内容を取得し、%%{init:...}%% でラップして返す
   */
  static getStylePrefix(id) {
    if (!id || !_styleCache[id]) return '';
    return `%%%%{init:${_styleCache[id]}}%%%%\n`;
  }

  /**
   * テキストが Mermaid 構文かどうかを判定する。
   * @param {string} txt
   * @returns {Promise<boolean>} Mermaid 構文なら true
   */
  static async detectType(txt) {
    if (!txt || !txt.trim()) return false;
    try {
      if (!this.isExists()) {
        await this.init(null, DefaultOpts);
      }
      globalThis.mermaid.detectType(txt);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 有効なダイアグラムキーワード一覧を返す。
   * knownKeywords と getRegisteredDiagramsMetadata() をマージし、
   * detectType() で実際に有効なもののみ返す。
   * @param {string[]} knownKeywords - 既知のキーワード候補
   * @returns {Promise<string[]>} ダイアグラムキーワードの配列
   */
  static async getDiagramTypes(knownKeywords = []) {
    if (!this.isExists()) {
      await this.init(null, DefaultOpts);
    }
    const m = globalThis.mermaid;
    if (!m?.detectType) return [];
    const candidates = new Set(knownKeywords);
    if (m.getRegisteredDiagramsMetadata) {
      for (const o of m.getRegisteredDiagramsMetadata()) {
        candidates.add(o.id);
      }
    }
    const types = [];
    for (const id of candidates) {
      try {
        m.detectType(id);
        types.push(id);
      } catch {
        // detectType が例外を投げる = 無効なキーワード
      }
    }
    return types;
  }

  /**
   * mermaidでパースしてSVGを生成する
   * @param {string} txt
   * @param {string} [styleTemplateId]
   */
  static async parse(txt, styleTemplateId) {
    const prefix = this.getStylePrefix(styleTemplateId);
    const fullTxt = prefix ? prefix + txt : txt;

    const cacheKey = _generation + ':' + fullTxt;
    const cached = _svgCache.get(cacheKey);
    if (cached) {
      // ヒットしたエントリを最新に繰り上げる（挿入順 Map による簡易 LRU）
      _svgCache.delete(cacheKey);
      _svgCache.set(cacheKey, cached);
      return cached;
    }

    return new Promise((res, rej) => {
      const renderId = 'mermaid-render-' + Date.now();
      var func = function () {
        mermaid.parse(fullTxt).then(() => {
          mermaid.render(renderId, fullTxt).then((data) => {
            _svgCache.set(cacheKey, data);
            if (_svgCache.size > SVG_CACHE_LIMIT) {
              _svgCache.delete(_svgCache.keys().next().value);
            }
            res(data);
          }).catch((err) => {
            rej(err);
          });
        }).catch((err) => {
          rej(err);
        });
      }

      if (this.isExists()) {
        func();
        return;
      }

      this.init(null, DefaultOpts).then(() => {
        func();
      }).catch((err) => {
        rej(err);
      })
    })
  }
}

export default MermaidScript;
