import Scripter from "./Scripter";

const Name = "mermaid";
const URL = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";

/**
 * mermaid を利用してパースするクラス
 */
class MermaidScript {

    static isExists() {
        return Scripter.isExists(Name)
    }

    static async init() {
        var rtn = new Promise( (res,rej) => {
          Scripter.getScript(URL).then( (s) => {
            var objFunc = new Function(s);
            objFunc();
            mermaid.initialize({ startOnLoad: false });
            res();
          }).catch( (err) => {
            rej(err);
          });
        })
        return rtn;
    }

    static async parse(txt) {
        var rtn = new Promise( (res,rej) => {

          var func = function() {
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

          if ( this.isExists() ) {
            func();
            return;
          }

          this.init().then( () => {
            func();
          }).catch( (err) => {
            rej(err);
          })
        })
        return rtn;
    }
}

export default MermaidScript;