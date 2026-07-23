import Scripter from "./Scripter";
import { parsePluginMeta, parseVersion, satisfiesRange, pluginCompatStatus, shouldApply } from "../pluginMeta";

const Name = "marked"

/**
 * marked のバージョンに依存しない HTML エスケープ。
 * marked 15 以降、カスタム拡張トークンのエスケープはプラグイン側の責任になったため、
 * プラグイン作者が使えるよう globalThis.binder.escape として提供する。
 */
function htmlEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * marked.js を利用するクラス
 *
 * ベンダー URL は setVendorUrl() で設定する。
 * CDN対応等の拡張は各アプリ側のラッパーで行う。
 */
class MarkedScript {

    static _vendorUrl = null;
    // バンドルした marked のバージョン文字列（各アプリの main.jsx で設定）。
    // ランタイムに marked.version が存在しないため、互換判定の基準として保持する。
    static _vendorVersion = null;
    // 直近に解決した marked 情報 { version, major, source }
    static _markedInfo = null;
    // プラグイン名 → { status, meta, applied } の互換判定結果
    static _pluginStatus = {};
    // init() の多重実行を防ぐための in-flight Promise。
    // ウォームアップ（先読み）と初回 parse() が並行しても、同じ初期化を共有して
    // エンジンを二重ロードしないようにする。
    static _initPromise = null;

    /**
     * ベンダー JS の URL を設定する（アプリ起動時に一度呼ぶ）
     */
    static setVendorUrl(url) {
        MarkedScript._vendorUrl = url;
    }

    /**
     * バンドルした marked のバージョンを設定する（各アプリの main.jsx で一度呼ぶ）
     */
    static setVendorVersion(version) {
        MarkedScript._vendorVersion = version;
    }

    static isExists() {
        return Scripter.isExists(Name)
    }

    /**
     * エンジンが未ロードなら init() を一度だけ実行する（多重実行は in-flight Promise で共有）。
     * 起動時のウォームアップ・初回 parse() のどちらから呼んでも安全。
     * @returns {Promise<void>}
     */
    static ensureInit() {
        if (this.isExists()) return Promise.resolve();
        if (!this._initPromise) {
            this._initPromise = Promise.resolve(this.init()).finally(() => {
                this._initPromise = null;
            });
        }
        return this._initPromise;
    }

    static reset() {
        // ESM動的importはブラウザにキャッシュされるため、
        // globalThis.marked を削除するだけでは marked の内部状態（use()で追加したextensions等）が残る。
        // setOptions(getDefaults()) でデフォルトに戻してから削除する。
        if (globalThis.marked && globalThis.marked.marked) {
            try {
                globalThis.marked.marked.setOptions(globalThis.marked.marked.getDefaults());
            } catch (e) {}
        }
        delete globalThis.marked;
    }

    /**
     * ベンダー版で初期化する。
     * サブクラスやラッパーで上書き可能。
     */
    static async init() {
        var m = await Scripter.import(MarkedScript._vendorUrl);
        globalThis.marked = m;
    }

    /**
     * URLからmarkedを読み込む（ESM → UMD の順に試行）
     * @param {string} url 読み込み先URL
     * @returns {boolean} 成功時true
     */
    static async tryLoadUrl(url) {
        delete globalThis.marked;
        try {
            var m = await Scripter.import(url);
            globalThis.marked = m;
            return true;
        } catch (esmErr) {
            try {
                await Scripter.loadScript(url, Name);
                return true;
            } catch (umdErr) {
                return false;
            }
        }
    }

    /**
     * 指定URLでmarkedを読み込み、失敗時はベンダー版にフォールバック。
     * @param {string} url 検証するURL
     * @returns {{ success: boolean }}
     */
    static async loadAndValidate(url) {
        delete globalThis.marked;
        if (url) {
            if (await MarkedScript.tryLoadUrl(url)) {
                return { success: true };
            }
        }
        var m = await Scripter.import(MarkedScript._vendorUrl);
        globalThis.marked = m;
        return { success: false };
    }

    /**
     * ロード済み marked からメジャーバージョンを推定する（機能プローブ）。
     * marked はランタイムにバージョンを公開しないため、URL・バンドル定数が
     * 使えない場合の最終手段。メジャー境界のみ判定できる（14 / 15 / 17）。
     * @returns {number|null}
     */
    static probeMajor() {
        const M = globalThis.marked;
        if (!M) return null;
        try {
            // v17 以降は list_item の子に checkbox トークンが生成される
            const items = M.Lexer.lex('- [ ] a\n')[0]?.items;
            if (items?.[0]?.tokens?.[0]?.type === 'checkbox') return 17;
        } catch { /* noop */ }
        try {
            // v14 と v17+ は alt 属性をエスケープする。ここは checkbox 無し確定なので
            // エスケープあり=14、なし=15/16（15 を代表値にする）
            const escaped = M.marked('![a"x](u)\n').includes('&quot;');
            return escaped ? 14 : 15;
        } catch { /* noop */ }
        return null;
    }

    /**
     * 現在動作している marked のバージョン情報を解決する。
     * @param {string|null} cdnUrl 実際に読み込んだ CDN URL（ベンダー版なら null）
     * @returns {{ version: string|null, major: number|null, source: string }}
     */
    static resolveMarkedInfo(cdnUrl) {
        let info;
        if (cdnUrl) {
            const m = String(cdnUrl).match(/marked@(\d+\.\d+\.\d+)/);
            if (m) {
                info = { version: m[1], major: parseVersion(m[1])[0], source: 'cdn' };
            } else {
                info = { version: null, major: this.probeMajor(), source: 'cdn' };
            }
        } else {
            const v = this._vendorVersion;
            info = {
                version: v || null,
                major: v ? parseVersion(v)[0] : this.probeMajor(),
                source: 'vendor',
            };
        }
        this._markedInfo = info;
        return info;
    }

    /**
     * 直近に解決した marked 情報を返す。
     */
    static getMarkedInfo() {
        return this._markedInfo;
    }

    /**
     * プラグインの互換判定結果（名前 → { status, meta, applied }）を返す。
     */
    static getPluginStatus() {
        return this._pluginStatus;
    }

    /**
     * プラグイン作者向けのランタイムコンテキストを globalThis.binder に用意する。
     * 既存プラグインは binder を参照しないため影響を受けない（opt-in）。
     */
    static installBinderContext(markedInfo) {
        const info = markedInfo || this._markedInfo || {};
        globalThis.binder = {
            marked: {
                version: info.version ?? null,
                major: info.major ?? null,
                source: info.source ?? null,
                satisfies(range) {
                    const v = this.version || (this.major != null ? String(this.major) : null);
                    if (v == null) return true;
                    return satisfiesRange(range, v);
                },
            },
            escape: htmlEscape,
        };
    }

    /**
     * ext 内の tokenizer / renderer / walkTokens を try/catch でラップし、
     * 例外を投げたプラグインを名指しで記録してプレビュー全体の巻き込みを防ぐ。
     */
    static _isolateExt(ext, pluginName) {
        const wrapFn = (fn, kind, fallback) => {
            if (typeof fn !== 'function') return fn;
            const self = this;
            return function (...args) {
                try {
                    return fn.apply(this, args);
                } catch (err) {
                    console.warn(`[Binder] Plugin "${pluginName}" ${kind} threw:`, err);
                    const st = self._pluginStatus[pluginName];
                    if (st) st.runtimeError = String(err && err.message || err);
                    return typeof fallback === 'function' ? fallback(args) : fallback;
                }
            };
        };

        const clone = { ...ext };

        if (Array.isArray(ext.extensions)) {
            clone.extensions = ext.extensions.map((e) => {
                const ec = { ...e };
                // tokenizer が投げたら undefined を返す（＝この記法にマッチしない扱い）
                ec.tokenizer = wrapFn(e.tokenizer, 'tokenizer', undefined);
                // renderer が投げたら空文字を返す（＝出力しない）
                ec.renderer = wrapFn(e.renderer, 'renderer', '');
                return ec;
            });
        }

        if (ext.renderer && typeof ext.renderer === 'object') {
            const r = {};
            for (const [k, fn] of Object.entries(ext.renderer)) {
                r[k] = typeof fn === 'function' ? wrapFn(fn, `renderer.${k}`, '') : fn;
            }
            clone.renderer = r;
        }

        if (typeof ext.walkTokens === 'function') {
            clone.walkTokens = wrapFn(ext.walkTokens, 'walkTokens', undefined);
        }

        return clone;
    }

    /**
     * プラグインを marked に適用する。
     *
     * @param {Array<{name:string, content:string}>} plugins
     * @param {{version:string|null, major:number|null, source:string}} [markedInfo]
     *        省略時は resolveMarkedInfo で解決済みの情報を使う。
     * @param {Object<string, number>} [verifiedMajors] プラグイン名 → 検証時 marked メジャー
     */
    static applyPlugins(plugins, markedInfo, verifiedMajors) {
        this._pluginStatus = {};

        // プラグインの有無に関わらず現在の marked 情報でコンテキストを更新する
        const info = markedInfo || this._markedInfo || {};
        this.installBinderContext(info);

        if (!plugins || plugins.length === 0) return;

        console.debug(`[Binder] Applying ${plugins.length} plugin(s) for marked ${info.version || info.major || '?'}`);

        for (const plugin of plugins) {
            const meta = parsePluginMeta(plugin.content);
            const verified = verifiedMajors ? verifiedMajors[plugin.name] : undefined;
            const status = pluginCompatStatus(meta, info, verified);
            this._pluginStatus[plugin.name] = { status, meta, applied: false };

            if (!shouldApply(status)) {
                console.warn(`[Binder] Plugin "${plugin.name}" skipped: incompatible with marked ${info.version || info.major} (requires ${meta.marked})`);
                continue;
            }
            if (status === 'unverified' || status === 'unknown') {
                console.warn(`[Binder] Plugin "${plugin.name}" applied with warning (${status}); current marked ${info.version || info.major}`);
            }

            try {
                const ext = (0, eval)(plugin.content);
                if (ext && typeof ext === 'object') {
                    marked.marked.use(this._isolateExt(ext, plugin.name));
                    this._pluginStatus[plugin.name].applied = true;
                    console.debug(`[Binder] Plugin "${plugin.name}" applied (${status})`);
                }
            } catch (err) {
                console.warn(`[Binder] Plugin "${plugin.name}" failed to load:`, err);
                this._pluginStatus[plugin.name].loadError = String(err && err.message || err);
            }
        }
    }

    static async parse(txt) {
        return new Promise((res, rej) => {
            var func = function() {
                try {
                    var rtn = marked.marked(txt);
                    res(rtn)
                } catch (err) {
                    rej(err);
                }
            }

            if (this.isExists()) {
                func();
            } else {
                this.ensureInit().then(() => {
                    func();
                }).catch((err) => {
                    rej(err);
                })
            }
        })
    }

    /**
     * ソース行番号付きで Markdown を HTML に変換する
     *
     * 各上位ブロックの直前に <!-- binder-line:N --> コメントを挿入して
     * marked でレンダリングする。プレビューのスクロール同期に利用する。
     */
    static async parseWithSourceLines(txt) {
        return new Promise((res, rej) => {
            const func = () => {
                try {
                    const topTokens = marked.Lexer.lex(txt);
                    const parts = [];
                    let currentLine = 1;

                    for (const token of topTokens) {
                        if (token.type !== 'space') {
                            parts.push(`<!-- binder-line:${currentLine} -->\n`);
                        }
                        parts.push(token.raw);
                        currentLine += (token.raw.match(/\n/g) || []).length;
                    }

                    const annotated = parts.join('');
                    res(marked.marked(annotated));
                } catch (err) {
                    rej(err);
                }
            };

            if (this.isExists()) {
                func();
            } else {
                this.ensureInit().then(func).catch(rej);
            }
        });
    }
}

export default MarkedScript;
