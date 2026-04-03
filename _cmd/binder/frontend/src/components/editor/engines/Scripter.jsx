
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
            // 既存の同名スクリプトタグを除去（バインダー切り替え時の再読み込み対応）
            const existing = document.querySelector(`script[data-scripter="${globalName}"]`);
            if (existing) existing.remove();

            const script = document.createElement('script');
            script.src = url;
            script.dataset.scripter = globalName;
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
    /**
     * URLのホスト名がホワイトリストに含まれているか検証する
     * @param {string} url 検証するURL
     * @param {string[]} allowedDomains 許可ドメインリスト
     * @returns {boolean} 許可されている場合true
     */
    static isAllowedUrl(url, allowedDomains) {
        if (!url || !allowedDomains || allowedDomains.length === 0) return false;
        try {
            const hostname = new URL(url).hostname;
            return allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
        } catch {
            return false;
        }
    }
}

export default Scripter;
