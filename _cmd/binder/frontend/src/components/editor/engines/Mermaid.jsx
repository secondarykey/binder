import Scripter from "./Scripter";
import { GetConfig } from "../../../../bindings/binder/api/app";
import mermaidVendorUrl from '../../../assets/vendor/mermaid.min.js?url';

const Name = "mermaid";

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
  static async init(url, opts) {

    if ( globalThis.mermaid !== undefined ) {
      return;
    }
    var mermaid = await this.load(url);

    mermaid.initialize(opts);
    globalThis.mermaid = mermaid;
  }

  /**
   * CDN URLが指定されている場合はESM importを試行。
   * 未指定またはESM import失敗時はベンダーUMDを<script>タグで読み込む。
   * @param {string|null} url CDN ESM URL（nullの場合はベンダーを使用）
   */
  static async load(url) {
    if (url) {
      try {
        var m = await Scripter.import(url);
        return m.default;
      } catch (err) {
        console.warn("CDN import failed, falling back to vendor:", err);
      }
    }
    // ベンダーUMDを<script>タグで読み込む
    return await Scripter.loadScript(mermaidVendorUrl, "mermaid");
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

      // バインダー設定からCDN URLを取得
      var cdnUrl = null;
      GetConfig().then((conf) => {
        if (conf && conf.mermaidUrl) cdnUrl = conf.mermaidUrl;
      }).catch(() => {}).finally(() => {
        this.init(cdnUrl, { startOnLoad: false, theme: "dark", look: 'handDrawn', handDrawn: true }).then(() => {
          func();
        }).catch((err) => {
          console.error(err)
          rej(err);
        })
      });
    })

    return rtn;
  }
}

export default MermaidScript;
