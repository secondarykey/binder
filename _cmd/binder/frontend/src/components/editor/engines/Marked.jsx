import Scripter from "./Scripter";
import { GetConfig } from "../../../../bindings/binder/api/app";
import markedVendorUrl from '../../../assets/vendor/marked.min.js?url';

const Name = "marked"

/**
 * marked.js を利用するクラス
 */
class MarkedScript {

    static isExists() {
        return Scripter.isExists(Name)
    }

    static async init() {
        let cdnUrl = null;
        try {
            const conf = await GetConfig();
            if (conf && conf.markedUrl) cdnUrl = conf.markedUrl;
        } catch (e) {}

        let script;
        if (cdnUrl) {
            // バインダー設定URL優先、失敗時にベンダーへフォールバック
            script = await Scripter.getWithFallback(cdnUrl, markedVendorUrl);
        } else {
            // デフォルト: 埋め込みベンダー
            script = await Scripter.get(markedVendorUrl);
        }
        var objFunc = new Function(script);
        objFunc();
        //MarkedScript.registerAlertExtension();
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
