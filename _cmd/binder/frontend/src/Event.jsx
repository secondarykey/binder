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
     * ツリーの再描画
     */
    static ReloadTree = "tree.reload"
    /**
     * ツリーの再描画
     */
    static ShowMessage = "message.show"

    /**
     * イベント登録
     * @param {*} key 
     * @param {*} func 
     */
    static register(key,func) {
        var e = this.eventMap[key];
        if ( e === undefined || e === null ) {
            e = [];
        }
        e.push(func);
        this.eventMap.set(key,e);
    }

    static changeTitle(title) {
        this.raise(Event.ReloadTitle,title);
    }

    static createMessage(type,msg) {
        return {
            type : type,
            message : msg,
        }
    }

    static clearMessage() {
    }

    static showSuccess(msg) {
        return createMessage("success",msg);
    }

    static showWarning(msg) {
        return createMessage("warning",msg);
    }

    static showInfoMessage(msg) {
        return createMessage("info",msg);
    }

    static showErrorMessage(err) {
        var obj = {};
        obj.type = "error";
        var msg = "";
        if (typeof err === 'object') {
          if (err.stack) {
            msg = err.stack;
          } else {
            msg = "unknown error:" + err;
          }
        } else {
          msg = err;
        }
        obj.message = msg;
        this.raise(this.ShowMessage,obj);
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