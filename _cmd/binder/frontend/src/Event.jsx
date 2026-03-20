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
     * メニューの表示
     */
    static ShowMenu = "menu.show"

    /**
     * サイドバーの開閉トグル
     */
    static ToggleSidebar = "sidebar.toggle"

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
     * エディタへのテキスト挿入（カーソル位置に挿入）
     */
    static InsertText = "editor.insert.text"

    /**
     * ツリーのノード選択
     */
    static SelectTree = "tree.select"

    /**
     * コミットモーダルを開く
     */
    static OpenCommitModal = "commit.modal.open"

    /**
     * 設定モーダルを開く
     */
    static OpenSettingModal = "setting.modal.open"

    /**
     * バインダー編集モーダルを開く
     */
    static OpenBinderModal = "binder.modal.open"

    /**
     * 公開一覧モーダルを開く
     */
    static OpenPublishModal = "publish.modal.open"

    /**
     * バインダーを開く（CheckCompat付き）
     */
    static OpenBinder = "binder.open"

    /**
     * GenerateForm へコメントを伝達
     */
    static PublishComment = "publish.comment"

    /**
     * Generate実行（GenerateFormからUnpublishedMenu側に伝達）
     */
    static PublishGenerate = "publish.generate"

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

    showMenu(flag) {
        this.raise(Event.ShowMenu, flag);
    }

    toggleSidebar() {
        this.raise(Event.ToggleSidebar);
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

    insertText(text) {
        this.raise(Event.InsertText, text);
    }

    selectTreeNode(id) {
        this.raise(Event.SelectTree, id);
    }

    openCommitModal() {
        this.raise(Event.OpenCommitModal);
    }

    openSettingModal() {
        this.raise(Event.OpenSettingModal);
    }

    openBinderModal() {
        this.raise(Event.OpenBinderModal);
    }

    openPublishModal() {
        this.raise(Event.OpenPublishModal);
    }

    openBinder(dir) {
        this.raise(Event.OpenBinder, dir);
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