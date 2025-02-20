
const markedName = "marked";
const mermaidName = "marked";

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
            import(url).then( (m) => {
                res(m);
            })
        })
        return rtn;
    }
}

export default Scripter;