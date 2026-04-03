import Scripter from "./Scripter";
import { GetConfig } from "../../../../bindings/binder/api/app";
import mermaidVendorUrl from '../../../assets/vendor/mermaid.min.js?url';

const Name = "mermaid";
const DefaultOpts = { startOnLoad: false, theme: "dark", look: 'handDrawn', handDrawn: true };

/**
 * mermaid を利用してパースするクラス（ESM / UMD 両対応）
 */
class MermaidScript {

  static isExists() {
    return Scripter.isExists(Name)
  }

  /**
   * バインダー切り替え時にグローバル状態をリセットし、次回parseで再初期化させる
   */
  static reset() {
    delete globalThis.mermaid;
  }

  /**
   * URLからmermaidを読み込む（ESM → UMD の順に試行）
   * @param {string} url 読み込み先URL
   * @returns {object|null} mermaidインスタンス。失敗時null
   */
  static async tryLoadUrl(url) {
    // ESM import を試行
    try {
      var m = await Scripter.import(url);
      return m.default;
    } catch (esmErr) {
      // UMD <script>タグを試行
      try {
        return await Scripter.loadScript(url, Name);
      } catch (umdErr) {
        return null;
      }
    }
  }

  /**
   * 初期化処理
   * CDN URL指定時: ESM → UMD → ベンダーの順にフォールバック
   * CDN URL未指定: ベンダーUMDを使用
   */
  static async init(url, opts) {

    if ( globalThis.mermaid !== undefined ) {
      return;
    }

    var mermaid = null;
    if (url) {
      mermaid = await MermaidScript.tryLoadUrl(url);
      if (!mermaid) {
        console.warn("CDN URL failed, falling back to vendor");
      }
    }
    if (!mermaid) {
      // ベンダーUMDを<script>タグで読み込む
      mermaid = await Scripter.loadScript(mermaidVendorUrl, Name);
    }

    mermaid.initialize(opts);
    globalThis.mermaid = mermaid;
  }

  /**
   * 指定URLでmermaidを読み込み、成功時はそのまま使用する。
   * 失敗時はベンダー版にフォールバックして初期化する。
   * @param {string} url 検証するURL
   * @returns {{ success: boolean }} 指定URLでの読み込み結果
   */
  static async loadAndValidate(url) {
    delete globalThis.mermaid;

    var mermaid = null;
    if (url) {
      mermaid = await MermaidScript.tryLoadUrl(url);
    }
    var success = (mermaid !== null);
    if (!mermaid) {
      mermaid = await Scripter.loadScript(mermaidVendorUrl, Name);
    }
    mermaid.initialize(DefaultOpts);
    globalThis.mermaid = mermaid;
    return { success };
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
        this.init(cdnUrl, DefaultOpts).then(() => {
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
