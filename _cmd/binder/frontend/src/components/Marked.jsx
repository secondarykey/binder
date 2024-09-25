import Scripter from "./Scripter";

const Name = "marked"
const URL = "https://cdn.jsdelivr.net/npm/marked@14/lib/marked.umd.min.js";

class MarkedScript {

    static isExists() {
        return Scripter.isExists(Name)
    }

    static async init() {
        var rtn = new Promise( (res,rej) => {
          Scripter.getScript(URL).then( (s) => {
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
}

export default MarkedScript;