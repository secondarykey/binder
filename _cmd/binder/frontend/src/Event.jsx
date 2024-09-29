export function useEvent() {
    return new Event();
}

/**
 * イベント
 */
class Event {

    /**
     * 管理イベント
     */
    static eventMap = new Map();
    /**
     * タイトル変更時
     */
    static ReloadTitle = "title.reload"

    /**
     * バインダー部分のタイトル変更
     */
    static ReloadBinderTitle = "binder.title.reload"

    /**
     * ツリーの再描画
     */
    static ReloadTree = "tree.reload"
    /**
     * ツリーの再描画
     */
    static ShowMessage = "message.show"

    /**
     * Binder の変更
     */
    static ChangeAddress = "change.address"

    /**
     * イベント登録
     * @param {*} key 
     * @param {*} func 
     */
    static register(key,func) {
        var e = this.eventMap.get(key);
        if ( e === undefined || e === null ) {
            e = [];
        }

        e.push(func);
        this.eventMap.set(key,e);
    }

    static refreshTree() {
        this.raise(Event.ReloadTree);
    }

    static changeTitle(title) {
        this.raise(Event.ReloadTitle,title);
    }

    static changeBinderTitle(title) {
        this.raise(Event.ReloadBinderTitle,title);
    }

    static changeAddress(address) {
        this.raise(Event.ChangeAddress,address);
    }
 

    /**
     * 登録されている関数を呼び出す
     * @param {*} key 
     * @param {*} obj 
     * @returns 
     */
    static raise(key,obj) {

        var evts = this.eventMap.get(key);
        if ( !evts ) {
            console.warn(key + " is not found.");
            return;
        }

        evts.forEach( f => {
            f(obj);
        })
    }
}

export default Event;