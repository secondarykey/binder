import Scripter from "./Scripter";

const Name = "marked"

/**
 * marked.js を利用するクラス
 *
 * ベンダー URL は setVendorUrl() で設定する。
 * CDN対応等の拡張は各アプリ側のラッパーで行う。
 */
class MarkedScript {

    static _vendorUrl = null;

    /**
     * ベンダー JS の URL を設定する（アプリ起動時に一度呼ぶ）
     */
    static setVendorUrl(url) {
        MarkedScript._vendorUrl = url;
    }

    static isExists() {
        return Scripter.isExists(Name)
    }

    static reset() {
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

    static applyPlugins(plugins) {
        if (!plugins || plugins.length === 0) return;
        console.info(`[Binder] Applying ${plugins.length} plugin(s)`);
        for (const plugin of plugins) {
            try {
                const fn = new Function(plugin.content);
                const ext = fn();
                console.info(`[Binder] Plugin "${plugin.name}":`, ext);
                if (ext && typeof ext === 'object') {
                    marked.marked.use(ext);
                    console.info(`[Binder] Plugin "${plugin.name}" applied`);
                }
            } catch (err) {
                console.warn(`[Binder] Plugin "${plugin.name}" failed to load:`, err);
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
                this.init().then(() => {
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
                this.init().then(func).catch(rej);
            }
        });
    }
}

export default MarkedScript;
