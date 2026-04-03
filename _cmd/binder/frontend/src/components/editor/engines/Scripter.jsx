
class Scripter {

    static isExists(name) {
        var func = new Function("return ( typeof " + name + " !== 'undefined' );");
        return func();
    }

    /**
     * ESM dynamic import
     * @param {string} url ESM URL
     */
    static async import(url) {
        return await import(/* @vite-ignore */ url);
    }

    /**
     * ESM dynamic import を試み、失敗時にフォールバックURLで再試行する
     * @param {string} primaryUrl CDN ESM URL
     * @param {string} fallbackUrl ローカルベンダー ESM URL
     */
    static async importWithFallback(primaryUrl, fallbackUrl) {
        try {
            return await Scripter.import(primaryUrl);
        } catch (err) {
            console.warn("CDN import failed, falling back to vendor:", err);
            return await Scripter.import(fallbackUrl);
        }
    }

    /**
     * UMDスクリプトを<script>タグで読み込む
     * fetch + new Function では動作しない大規模UMDライブラリ向け。
     * @param {string} url スクリプトURL
     * @param {string} globalName グローバル変数名
     */
    static async loadScript(url, globalName) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => {
                if (globalThis[globalName]) {
                    resolve(globalThis[globalName]);
                } else {
                    reject(new Error(`${globalName} not found after loading ${url}`));
                }
            };
            script.onerror = (err) => {
                reject(new Error(`Failed to load script: ${url}`));
            };
            document.head.appendChild(script);
        });
    }
}

export default Scripter;
