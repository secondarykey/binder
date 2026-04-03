import Scripter from "./Scripter";
import { GetConfig } from "../../../../bindings/binder/api/app";
import markedVendorUrl from '../../../assets/vendor/marked.min.js?url';

const Name = "marked"

/**
 * marked.js を利用するクラス（ESM / UMD 両対応）
 */
class MarkedScript {

    static isExists() {
        return Scripter.isExists(Name)
    }

    /**
     * バインダー切り替え時にグローバル状態をリセットし、次回parseで再初期化させる
     */
    static reset() {
        delete globalThis.marked;
    }

    /**
     * URLからmarkedを読み込む（ESM → UMD の順に試行）
     * @param {string} url 読み込み先URL
     * @returns {boolean} 成功時true
     */
    static async tryLoadUrl(url) {
        delete globalThis.marked;
        // ESM import を試行
        try {
            var m = await Scripter.import(url);
            globalThis.marked = m;
            return true;
        } catch (esmErr) {
            // UMD <script>タグを試行
            try {
                await Scripter.loadScript(url, Name);
                // UMDはglobalThis.markedを直接設定する
                return true;
            } catch (umdErr) {
                return false;
            }
        }
    }

    /**
     * バインダー設定に基づいて初期化する。
     * CDN URL指定時: ESM → UMD → ベンダーの順にフォールバック
     * CDN URL未指定: ベンダーESMを使用
     */
    static async init() {
        let cdnUrl = null;
        try {
            const conf = await GetConfig();
            if (conf && conf.markedUrl) cdnUrl = conf.markedUrl;
        } catch (e) {}

        if (cdnUrl) {
            if (await MarkedScript.tryLoadUrl(cdnUrl)) return;
            console.warn("CDN URL failed, falling back to vendor");
        }
        // デフォルト: 埋め込みベンダーESM
        var m = await Scripter.import(markedVendorUrl);
        globalThis.marked = m;
        //MarkedScript.registerAlertExtension();
    }

    /**
     * 指定URLでmarkedを読み込み、成功時はそのまま使用する。
     * 失敗時はベンダー版にフォールバックして初期化する。
     * @param {string} url 検証するURL
     * @returns {{ success: boolean }} 指定URLでの読み込み結果
     */
    static async loadAndValidate(url) {
        delete globalThis.marked;
        if (url) {
            if (await MarkedScript.tryLoadUrl(url)) {
                return { success: true };
            }
        }
        // ベンダーにフォールバック
        var m = await Scripter.import(markedVendorUrl);
        globalThis.marked = m;
        return { success: false };
    }

    /**
     * GitHub スタイルのアラート拡張を登録する
     *
     * blockquote 内の最初の行が [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]
     * のいずれかである場合、対応するスタイル付きアラートブロックに変換する。
     */
    static registerAlertExtension() {
        const alertTypes = {
            NOTE:      { label: 'Note',      color: '#1f6feb', icon: 'ℹ' },
            TIP:       { label: 'Tip',       color: '#238636', icon: '💡' },
            IMPORTANT: { label: 'Important', color: '#8957e5', icon: '📣' },
            WARNING:   { label: 'Warning',   color: '#d29922', icon: '⚠' },
            CAUTION:   { label: 'Caution',   color: '#da3633', icon: '🔴' },
        };

        marked.marked.use({
            renderer: {
                blockquote(token) {
                    const html = this.parser.parse(token.tokens);
                    // <p> の先頭にアラートマーカーがあるか確認
                    const match = html.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/);
                    if (!match) {
                        return `<blockquote>\n${html}</blockquote>\n`;
                    }

                    const type = match[1];
                    const cfg = alertTypes[type];
                    // マーカー行を除去した本文
                    const body = html.replace(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/, '<p>');

                    return `<div class="markdown-alert markdown-alert-${type.toLowerCase()}" style="border-left: 4px solid ${cfg.color}; padding: 8px 16px; margin: 16px 0; border-radius: 4px;">
  <p class="markdown-alert-title" style="font-weight: 600; color: ${cfg.color}; margin: 0 0 4px 0;">${cfg.icon} ${cfg.label}</p>
  ${body}
</div>\n`;
                }
            }
        });
    }

    static async parse(txt) {

        var rtn = new Promise( (res,rej) => {
          //変換処理を関数化
          var func = function() {
            try {
              var rtn = marked.marked(txt);
              res(rtn)
            } catch (err) {
              rej(err);
            }
          }

          if ( this.isExists() ) {
            func();
          } else {
            this.init().then( () => {
              func();
            }).catch( (err) => {
              rej(err);
              return;
            })
          }

        })
        return rtn;
    }

    /**
     * ソース行番号付きで Markdown を HTML に変換する
     *
     * 各上位ブロック（段落・見出し・コードブロック等）の直前に
     * HTML コメント <!-- binder-line:N --> を挿入して marked でレンダリングする。
     * HTMLFrame.postProcess 内でコメントを走査し、次の要素に
     * data-src-line 属性を付与することでプレビューのスクロール同期に利用する。
     *
     * marked 本体は変更せず、公式の Lexer API のみ使用する。
     */
    static async parseWithSourceLines(txt) {
        return new Promise((res, rej) => {
            const func = () => {
                try {
                    // 上位ブロックトークンを取得し、各トークンの開始行を計算する
                    const topTokens = marked.Lexer.lex(txt);
                    const parts = [];
                    let currentLine = 1;

                    for (const token of topTokens) {
                        // space トークン（空白行）にはコメントを挿入しない
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
