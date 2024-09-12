
/**
 * 実環境でスクリプトを読み込んで処理
 * <pre>
 * 自分の使いたいバージョンを指定できるように
 * React上で埋め込むのではなく、その場で読み込んで処理を行えるようにする為、
 * 実環境で読み込んで処理できるようにしました。
 * </pre>
 */
class RuntimeScript {

    static isMarkedExists() {
        return this.isExists("marked");
    }

    static isMermaidExists() {
        return this.isExists("mermaid");
    }

    /**
     * 対象オブジェクトが存在するか確認
     * @param name 変数名
     * @returns true = 存在する
     */
    static isExists(name: string) {
        var func = new Function("return ( typeof " + name + " !== 'undefined' );");
        return func();
    }

    //https://cdn.jsdelivr.net/npm/marked/lib/marked.umd.min.js :latest
    //https://cdn.jsdelivr.net/npm/marked@13/lib/marked.umd.min.js :latest -miner
    static async loadMarked(force: boolean) {
        //すでに存在すれば処理しない
        var url = "https://cdn.jsdelivr.net/npm/marked@13/lib/marked.umd.min.js";
        if (!this.isMarkedExists() || force) {
            console.log("load marked")
            await this.loadScript(url);
        }
    }

    //https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js : Latest
    //https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js : miner
    static async loadMermaid(force: boolean) {
        var url = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
        if (!this.isMermaidExists() || force) {
            await this.loadScript(url);
        }
    }

    /**
     * マークダウンを解析
     * @param txt 
     * @returns Promiss("data" === HTML)
     */
    static async marked(txt: string) {
        if (!this.isMarkedExists()) {
            throw Error("'marked' object does not exist. call loadMarked().");
        }
        var func = new Function("txt", "return marked.parse(txt);");
        return func(txt);
    }

    /**
     * Mermaid構文を解析
     * @param txt 文字列
     * @returns Promiss("data.svg" === SVG)
     */
    static async mermaid(txt: string) {
        if (!this.isMermaidExists()) {
            throw Error("'mermaid' object does not exist. call loadMermaid().");
        }
        var func = new Function("txt", "return mermaid.render('svg',txt);");
        return func(txt);
    }

    /**
     * 指定したURLのファイルをスクリプトとして実行
     * @param url 
     */
    static async loadScript(url: string) {
        await fetch(url)
            .then(resp => resp.text())
            .then(script => {
                //オブジェクトとして扱いたい場合はreturnで取得できる
                //var objFunc = new Function(script + "return mermaid;");
                var objFunc = new Function(script);
                objFunc();
            })
            .catch((err) => {
                console.log(err);
            });
    }
}

export default RuntimeScript;