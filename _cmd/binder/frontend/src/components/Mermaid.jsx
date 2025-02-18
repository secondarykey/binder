import Scripter from "./Scripter";

const Name = "mermaid";
const URL    = "https://cdn.jsdelivr.net/npm/mermaid@11/+esm";
const ZenURL = "https://cdn.jsdelivr.net/npm/@mermaid-js/mermaid-zenuml/+esm";
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
  static async init() {

    var m = await import(URL);
    var mermaid = m.default;
    mermaid.initialize({ startOnLoad: false });
    globalThis.mermaid = mermaid;

    var z = await import(ZenURL);
    mermaid.registerExternalDiagrams([z.default]);

    console.log("init()")
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

      this.init().then(() => {
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