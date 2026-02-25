import Scripter from "./Scripter";

const Name = "mermaid";
const URL    = "https://cdn.jsdelivr.net/npm/mermaid@11/+esm";
//const ZenURL = "https://cdn.jsdelivr.net/npm/@mermaid-js/mermaid-zenuml/+esm";
//const URL = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
//const URL = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
//const URL = "https://cdn.jsdelivr.net/npm/@mermaid-js/mermaid-zenuml@0.2.0/dist/mermaid-zenuml.min.js"

/**
 * mermaid を利用してパースするクラス
 */
class MermaidScript {

  static isExists() {
    return Scripter.isExists(Name)
  }

  /**
   * 初期化処理
   */
  static async init(url,opts) {

    if ( globalThis.mermaid !== undefined ) {
      return;
    }
    var mermaid = await this.load(url);

    mermaid.initialize(opts);
    globalThis.mermaid = mermaid;

    //var z = await import(ZenURL);
    //mermaid.registerExternalDiagrams([z.default]);
  }

  /**
   * 
   * @param {*} url 
   */
  static async load(url) {
    var m = await import(url);
    var mermaid = m.default;
    return mermaid;
  }

  static async parse(txt) {

    var rtn = new Promise((res, rej) => {

      var func = function () {
        mermaid.parse(txt).then(() => {
          mermaid.render('svg', txt).then((data) => {
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

      this.init(URL,{ startOnLoad: false,theme:"dark",handDrawn:true }).then(() => {
        func();
      }).catch((err) => {
        console.error(err)
        rej(err);
      })
    })

    return rtn;
  }
}

export default MermaidScript;