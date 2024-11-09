import Scripter from "./Scripter";

const Name = "mermaid";
//const URL = "https://cdn.jsdelivr.net/npm/mermaid@11.2.1/dist/mermaid.min.js";
//const URL = "https://cdn.jsdelivr.net/npm/mermaid@11.2.1/+esm";
const URL = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";

/**
 * mermaid を利用してパースするクラス
 */
class MermaidScript {

  static isExists() {
    return Scripter.isExists(Name)
  }

  static async init() {

    //11 のURLだと、defaultがないって言われる
    //+esm だとimport (URL) が可能だけどinitialize が実行できない
    var rtn = new Promise((res, rej) => {
      Scripter.getScript(URL).then((s) => {
        var func = new Function(s);
        func();
        res();
      }).catch((err) => {
        rej(err);
      });
    })
    return rtn;
  }

  static async parse(txt) {

    var rtn = new Promise((res, rej) => {
      var func = function () {
        mermaid.parse(txt).then(() => {
          mermaid.render('svg', txt).then((data) => {
            res(data);
          }).catch((err) => {
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
        rej(err);
      })
    })
    return rtn;
  }
}

export default MermaidScript;