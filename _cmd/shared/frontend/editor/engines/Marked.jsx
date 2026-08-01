import Scripter from "./Scripter";
import { parsePluginMeta, parseVersion, satisfiesRange, pluginCompatStatus, shouldApply } from "../pluginMeta";

const Name = "marked"

/**
 * プラグイン警告の既定文言（英語）。
 * Lite など i18n を持たない呼び出し元、翻訳キー未定義時のフォールバックに使う。
 */
const DEFAULT_PLUGIN_WARNINGS = {
    'plugin.warn.loadError': (p) => `Plugin "${p.name}" failed to load: ${p.error}`,
    'plugin.warn.incompatible': (p) => `Plugin "${p.name}" was skipped: requires marked ${p.range}, current is ${p.current}`,
    'plugin.warn.notApplied': (p) => `Plugin "${p.name}" was not applied`,
    'plugin.warn.runtimeError': (p) => `Plugin "${p.name}" threw at runtime and its output was dropped: ${p.error}`,
    'plugin.warn.neverApplied': () => 'Plugins have not been applied to the current marked engine (reopen the binder or restart)',
    'marked.warn.cdnFallback': (p) => `Could not load the specified marked URL (${p.url}); running on the bundled ${p.bundled} instead`,
    'marked.warn.cdnBlocked': (p) => `The specified marked URL (${p.url}) is not in the allowed CDN list; running on the bundled ${p.bundled} instead`,
}

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
    // 現在ロードされているエンジンに対して applyPlugins() を通したか。
    // エンジンを差し替えたのにプラグインを再適用し忘れた状態を検出するために持つ。
    static _pluginsApplied = false;
    // 「どの URL を読もうとしたか」。_markedInfo は実際に読めた結果しか持たないため、
    // 指定したのにベンダー版で動いている（＝黙ってフォールバックした）状態を
    // 検出するには要求側の情報が要る。{ url, blocked } を各アプリの init が設定する。
    static _engineRequest = null;
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

    /**
     * バンドルした marked のバージョン（未指定時に動作する版）を返す。
     */
    static getVendorVersion() {
        return MarkedScript._vendorVersion;
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

    /**
     * エンジン実体を差し替えた（＝これまで use() したプラグインが失われた）ことを記録する。
     * 再度 applyPlugins() を通すまで、プラグインは一本も効いていない状態になる。
     */
    static _markEngineSwapped() {
        this._pluginsApplied = false;
        this._pluginStatus = {};
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
        MarkedScript._markEngineSwapped();
    }

    /**
     * ベンダー版で初期化する。
     * サブクラスやラッパーで上書き可能。
     */
    static async init() {
        MarkedScript._markEngineSwapped();
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
        MarkedScript._markEngineSwapped();
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
     *
     * 注意: このメソッドはエンジン実体を差し替えるだけで、プラグインの再適用は行わない。
     * 呼び出し元は成否に関わらず、続けてプラグインを適用し直すこと
     * （Binder では reset() → ensureInit() で init 経路をやり直す）。
     *
     * @param {string} url 検証するURL
     * @returns {{ success: boolean }}
     */
    static async loadAndValidate(url) {
        delete globalThis.marked;
        MarkedScript._markEngineSwapped();
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
            if (items?.[0]?.tokens?.[0]?.type === 'checkbox') {
                // v18 以降は見出し直後の空行が独立した space トークンになる
                // （v17 までは heading.raw に "# h\n\n" と含まれる）
                try {
                    if (M.Lexer.lex('# h\n\nx\n')[0]?.raw === '# h') return 18;
                } catch { /* noop */ }
                return 17;
            }
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
            // "marked@18" / "marked@18.0" のようにパッチ以下を省いた URL も CDN では有効なため、
            // x.y.z 固定にせず 1〜3 要素を許容する（parseVersion が 0 で埋める）。
            const m = String(cdnUrl).match(/marked@(\d+(?:\.\d+){0,2})/);
            if (m) {
                // パッチまで揃っている時だけ version として扱う。
                // "marked@18" を 18.0.0 と見なすと ">=18.1" 等を誤判定するため、
                // 部分指定はメジャーのみ確定させ version は不明のままにする。
                const full = /^\d+\.\d+\.\d+$/.test(m[1]);
                info = {
                    version: full ? m[1] : null,
                    major: parseVersion(m[1])[0],
                    source: 'cdn',
                };
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
     * プラグインが「意図どおり動いていない」状態を警告メッセージの配列で返す。
     *
     * 互換層はプレビューを落とさないために失敗を握り潰すため、これを UI に出さないと
     * ユーザは記法が消えたことにしか気付けない。プレビューの警告バーへ流すために使う。
     *
     * @param {(key:string, params?:Object) => string} [t] 翻訳関数。省略時は英語の既定文言
     * @returns {string[]}
     */
    /**
     * エンジン読み込みの要求内容を記録する。CDN 指定を持つアプリの init から呼ぶ。
     * @param {{url: string|null, blocked?: boolean}} req
     *        url: 設定された CDN URL（未指定なら null） / blocked: 許可ドメイン外で弾いたか
     */
    static setEngineRequest(req) {
        this._engineRequest = req || null;
    }

    /**
     * エンジンが「指定どおりに読めていない」状態を警告メッセージの配列で返す。
     *
     * CDN 指定はバージョン固定の手段として使われるため、読めずにベンダー版へ
     * 落ちたことに気付けないと、固定したつもりで別バージョンが動く。
     *
     * @param {(key:string, params?:Object) => string} [t] 翻訳関数
     * @returns {string[]}
     */
    static getEngineWarnings(t) {
        const req = this._engineRequest;
        if (!req || !req.url) return [];
        // まだ一度も解決していない（init 前）は判断材料が無いので黙る
        if (!this._markedInfo) return [];
        if (this._markedInfo.source !== 'vendor') return [];

        const params = { url: req.url, bundled: this._vendorVersion || '?' };
        return [this._translate(t, req.blocked ? 'marked.warn.cdnBlocked' : 'marked.warn.cdnFallback', params)];
    }

    /**
     * エンジンとプラグインの警告をまとめて返す。プレビュー・出力はこれを使う。
     * @param {(key:string, params?:Object) => string} [t] 翻訳関数
     * @returns {string[]}
     */
    static getWarnings(t) {
        return [...this.getEngineWarnings(t), ...this.getPluginWarnings(t)];
    }

    /**
     * 翻訳関数があればそれを使い、無い／キー未定義なら英語の既定文言に落とす。
     */
    static _translate(t, key, params) {
        if (typeof t === 'function') {
            const s = t(key, params);
            // i18next はキー未定義時にキーそのものを返す
            if (s && s !== key) return s;
        }
        return DEFAULT_PLUGIN_WARNINGS[key](params || {});
    }

    static getPluginWarnings(t) {
        const tr = (key, params) => this._translate(t, key, params);

        const info = this._markedInfo || {};
        const current = info.version || (info.major != null ? String(info.major) : '?');
        const out = [];

        // エンジンを差し替えたまま再適用されていない＝プラグインが一本も効いていない
        if (this.isExists() && !this._pluginsApplied) {
            out.push(tr('plugin.warn.neverApplied', {}));
            return out;
        }

        for (const [name, st] of Object.entries(this._pluginStatus || {})) {
            if (st.loadError) {
                out.push(tr('plugin.warn.loadError', { name, error: st.loadError }));
                continue;
            }
            if (st.status === 'incompatible') {
                out.push(tr('plugin.warn.incompatible', {
                    name, range: (st.meta && st.meta.marked) || '?', current,
                }));
                continue;
            }
            if (!st.applied) {
                out.push(tr('plugin.warn.notApplied', { name }));
                continue;
            }
            if (st.runtimeError) {
                out.push(tr('plugin.warn.runtimeError', { name, error: st.runtimeError }));
            }
        }

        return out;
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

        // renderer が投げた場合はトークンの元ソースをエスケープして返す。
        // 空文字を返すと記法もろとも消えてしまい、ユーザは異常に気付けない。
        // 生ソースが残れば「変換されていない」ことが目視で分かる。
        const rawFallback = (args) => {
            const raw = args && args[0] && args[0].raw;
            return typeof raw === 'string' ? htmlEscape(raw) : '';
        };

        const clone = { ...ext };

        if (Array.isArray(ext.extensions)) {
            clone.extensions = ext.extensions.map((e) => {
                const ec = { ...e };
                // tokenizer が投げたら undefined を返す（＝この記法にマッチしない扱い。
                // 素のテキストとして残るので、これ自体が目視のシグナルになる）
                ec.tokenizer = wrapFn(e.tokenizer, 'tokenizer', undefined);
                ec.renderer = wrapFn(e.renderer, 'renderer', rawFallback);
                return ec;
            });
        }

        if (ext.renderer && typeof ext.renderer === 'object') {
            const r = {};
            for (const [k, fn] of Object.entries(ext.renderer)) {
                r[k] = typeof fn === 'function' ? wrapFn(fn, `renderer.${k}`, rawFallback) : fn;
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
        // 0本でも「現在のエンジンに対して適用処理を通した」とみなす。
        // 未適用（エンジン差し替え後の再適用漏れ）と 0本設定を区別するため。
        this._pluginsApplied = true;

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
