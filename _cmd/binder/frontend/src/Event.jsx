import { createContext, useContext, useEffect, useRef } from "react";
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
     * 未コミットIDのみ再取得（ツリー全体の再描画は行わない）
     */
    static ReloadModified = "modified.reload"

    /**
     * 指定IDをローカルダーティとしてマーク（自動コミット操作後のUI用）
     */
    static MarkModified = "item.mark.modified"
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
    static OpenPublishSubtreeModal = "publish.modal.subtree.open"

    /**
     * Pushモーダルを開く
     */
    static OpenPushModal = "push.modal.open"

    /**
     * Mergeモーダルを開く
     */
    static OpenMergeModal = "merge.modal.open"

    /**
     * ブランチ変更モーダルを開く
     */
    static OpenBranchModal = "branch.modal.open"

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
     * コミット完了（CommitFiles成功後に発火 — localDirtyIds クリア用）
     */
    static CommitDone = "commit.done"

    /**
     * 公開完了 / 非公開化完了（Generate/Unpublish成功後に発火 — unpublishedMap 再取得用）
     */
    static ReloadUnpublished = "unpublished.reload"

    /**
     * 指定IDをローカル未公開ダーティとしてマーク（テキスト編集後のUI用）
     */
    static MarkPublishDirty = "item.mark.publish.dirty"

    /**
     * コミット進捗（ModifiedMenuからCommit側に伝達）
     */
    static ModifiedProgress = "git.modified.progress"

    /**
     * Generate進捗（UnpublishedMenuからGenerateForm側に伝達）
     */
    static PublishProgress = "publish.progress"

    /**
     * 管理イベント: key -> Set<handler>
     */
    eventMap = new Map();

    /**
     * イベント購読。解除関数を返す。
     * React コンポーネントからは useEventListener フックの利用を推奨。
     * @param {string} key イベントキー
     * @param {Function} handler ハンドラ
     * @returns {Function} 購読解除関数
     */
    on(key, handler) {
        let set = this.eventMap.get(key);
        if (!set) {
            set = new Set();
            this.eventMap.set(key, set);
        }
        set.add(handler);
        return () => {
            const s = this.eventMap.get(key);
            if (s) {
                s.delete(handler);
                if (s.size === 0) {
                    this.eventMap.delete(key);
                }
            }
        };
    }

    /**
     * イベント登録（後方互換シム）。
     * 旧 register(component, key, func) のシグネチャを維持するが、
     * 内部は on() に委譲する。component 引数は無視される。
     * 解除は useEventListener / on() の戻り値で行うこと。
     * @deprecated useEventListener フックまたは on() を使用すること
     */
    register(component, key, func) {
        return this.on(key, func);
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

    reloadModified() {
        this.raise(Event.ReloadModified);
    }

    commitDone() {
        this.raise(Event.CommitDone);
    }

    reloadUnpublished() {
        this.raise(Event.ReloadUnpublished);
    }

    markPublishDirty(id) {
        this.raise(Event.MarkPublishDirty, id);
    }

    markModified(id) {
        this.raise(Event.MarkModified, id);
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

    openCommitModal(data) {
        this.raise(Event.OpenCommitModal, data);
    }

    openSettingModal() {
        this.raise(Event.OpenSettingModal);
    }

    openBinderModal() {
        this.raise(Event.OpenBinderModal);
    }

    openPublishModal(data) {
        this.raise(Event.OpenPublishModal, data);
    }

    openPublishSubtreeModal(data) {
        this.raise(Event.OpenPublishSubtreeModal, data);
    }

    openPushModal() {
        this.raise(Event.OpenPushModal);
    }

    openMergeModal() {
        this.raise(Event.OpenMergeModal);
    }

    openBranchModal() {
        this.raise(Event.OpenBranchModal);
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
     * 購読中のハンドラを呼び出す（発火）
     * @param {string} key イベントキー
     * @param {*} obj ペイロード
     */
    raise(key, obj) {
        const set = this.eventMap.get(key);
        if (!set) {
            return;
        }
        // 反復中のSet変更（解除）に備えてコピーしてから呼ぶ
        [...set].forEach((handler) => handler(obj));
    }
}

const defaultEvent = new Event();
export const EventContext = createContext(defaultEvent);
export { defaultEvent };

/**
 * イベント購読フック。
 * - unmount 時に自動で購読解除する
 * - 最新の handler クロージャを常に参照する（stale closure を回避）
 * @param {string} key Event.* の静的キー
 * @param {Function} handler ペイロードを受け取るハンドラ
 */
export function useEventListener(key, handler) {
    const evt = useContext(EventContext);
    const handlerRef = useRef(handler);

    // レンダーごとに最新の handler を保持
    useEffect(() => {
        handlerRef.current = handler;
    });

    // 購読は key / evt が変わったときのみ張り直す
    useEffect(() => {
        const off = evt.on(key, (obj) => handlerRef.current(obj));
        return off;
    }, [evt, key]);
}

export default Event;
