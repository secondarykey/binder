import Scripter from "./Scripter";
import mermaidVendorUrl from '../../../assets/vendor/mermaid.min.js?url';

const Name = "mermaid";
const DefaultOpts = { startOnLoad: false };

/**
 * mermaid を利用してパースするクラス（binder-lite 用簡易版）
 * CDN設定なし、常にベンダー版を使用する。
 */
class MermaidScript {

  static isExists() {
    return Scripter.isExists(Name)
  }

  static reset() {
    delete globalThis.mermaid;
  }

  static async init() {
    if (globalThis.mermaid !== undefined) {
      return;
    }
    var mermaid = await Scripter.loadScript(mermaidVendorUrl, Name);
    mermaid.initialize(DefaultOpts);
    globalThis.mermaid = mermaid;
  }

  static async parse(txt) {
    return new Promise((res, rej) => {
      const renderId = 'mermaid-render-' + Date.now();
      var func = function () {
        mermaid.parse(txt).then(() => {
          mermaid.render(renderId, txt).then((data) => {
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
        rej(err);
      })
    })
  }
}

export default MermaidScript;
