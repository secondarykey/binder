import { createContext } from "react";
import Message from "./Message";
/**
 * イベント
 */
class Event {

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
     * Commitへコメントを伝達
     */
    static ModifiedComment = "git.modified.comment"

    /**
     * コミット(Commit画面からModifiedTree側に伝達)
     */
    static ModifiedCommit = "git.modified.commit"

    /**
     * 管理イベント
     */
    eventMap = new Map();

    /**
     * イベント登録
     * @param {*} key 
     * @param {*} func 
     */
    register(component,key,func) {

        var e = this.eventMap.get(key);
        if ( e === undefined || e === null ) {
            e = [];
        }

        var newE = [];
        e.forEach( (obj) => {
            if ( obj.key !== component ) {
                newE.push(obj);
            }
        })

        var obj = {};
        obj.key = component;
        obj.func = func;

        newE.push(obj);
        this.eventMap.set(key,newE);
    }

    refreshTree() {
        this.raise(Event.ReloadTree);
    }

    changeTitle(title) {
        this.raise(Event.ReloadTitle,title);
    }

    changeBinderTitle(title) {
        this.raise(Event.ReloadBinderTitle,title);
    }

    changeAddress(address) {
        this.raise(Event.ChangeAddress,address);
    }

    showMessage(obj) {
        this.raise(Event.ShowMessage, obj);
    }

    clearMessage() {
        var mo = Message.createMessage("clear", "");
        this.showMessage(mo);
    }

    showSuccessMessage(msg) {
        var mo = Message.createMessage("success", msg);
        this.showMessage(mo);
    }

    showWarningMessage(msg) {
        console.warn(msg)
        var mo = Message.createMessage("warning", msg);
        this.showMessage(mo);
    }

    showInfoMessage(msg) {
        var mo = Message.createMessage("info", msg);
        this.showMessage(mo);
    }

    showErrorMessage(err) {
        var mo = Message.createMessage("error", err);
        this.showMessage(mo);
    }

    /**
     * 登録されている関数を呼び出す
     * @param {*} key 
     * @param {*} obj 
     * @returns 
     */
    raise(key,obj) {

        var evts = this.eventMap.get(key);
        if ( !evts ) {
            console.warn(key + " is not found.");
            return;
        }

        evts.forEach( wk => {
            wk.func(obj);
        })
    }
}

export const EventContext = createContext(new Event());

export default Event;