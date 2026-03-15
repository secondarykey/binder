import Scripter from "./Scripter";

const Name = "marked"
const URL = "https://cdn.jsdelivr.net/npm/marked@14/lib/marked.umd.min.js";

/**
 * marked.js を利用するクラス
 */
class MarkedScript {

    static isExists() {
        return Scripter.isExists(Name)
    }

    static async init() {
        var rtn = new Promise( (res,rej) => {
          Scripter.get(URL).then( (s) => {
            var objFunc = new Function(s);
            objFunc();
            res();
          }).catch( (err) => {
            rej(err);
          });
        })
        return rtn;
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
