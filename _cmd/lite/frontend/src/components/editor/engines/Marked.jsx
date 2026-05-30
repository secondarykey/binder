import Scripter from "./Scripter";
import markedVendorUrl from '../../../assets/vendor/marked.min.js?url';

const Name = "marked"

/**
 * marked.js を利用するクラス（binder-lite 用簡易版）
 * CDN設定なし、常にベンダー版を使用する。
 */
class MarkedScript {

    static isExists() {
        return Scripter.isExists(Name)
    }

    static reset() {
        delete globalThis.marked;
    }

    static async init() {
        var m = await Scripter.import(markedVendorUrl);
        globalThis.marked = m;
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
