
class Scripter {

    static isExists(name) {
        var func = new Function("return ( typeof " + name + " !== 'undefined' );");
        return func();
    }

    /**
     * 指定したURLのファイルをスクリプトとして実行
     * @param url
     */
    static async get(url) {
        var rtn = new Promise((resolve, reject) => {
            fetch(url).then(resp => resp.text()).then(script => {
                //オブジェクトとして扱いたい場合はreturnで取得できる
                resolve(script);
            }).catch((err) => {
                console.log(err)
                reject(err);
            });
        });
        return rtn;
    }

    static async import(url) {
        var rtn = new Promise( (res,rej) => {
            import(/* @vite-ignore */ url).then( (m) => {
                res(m);
            })
        })
        return rtn;
    }

    /**
     * CDN URLからスクリプトを取得し、失敗時にフォールバックURLから取得する
     * @param {string} primaryUrl CDN URL
     * @param {string} fallbackUrl ローカルベンダーURL
     */
    static async getWithFallback(primaryUrl, fallbackUrl) {
        try {
            return await Scripter.get(primaryUrl);
        } catch (err) {
            console.warn("CDN load failed, falling back to vendor:", err);
            return await Scripter.get(fallbackUrl);
        }
    }

    /**
     * CDN ESM importを試み、失敗時にUMDベンダーファイルをフォールバックとして読み込む
     * @param {string} primaryUrl CDN ESM URL
     * @param {string} fallbackUrl ローカルベンダーUMD URL
     * @param {string} globalName UMDがエクスポートするグローバル変数名
     */
    static async importWithFallback(primaryUrl, fallbackUrl, globalName) {
        try {
            return await Scripter.import(primaryUrl);
        } catch (err) {
            console.warn("CDN ESM import failed, falling back to vendor UMD:", err);
            var script = await Scripter.get(fallbackUrl);
            new Function(script)();
            return { default: globalThis[globalName] };
        }
    }
}

export default Scripter;
