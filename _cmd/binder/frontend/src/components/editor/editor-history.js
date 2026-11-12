import { Events } from '@wailsio/runtime';

/**
 * エディタ専用の閲覧履歴スタック（MRU方式）。
 * 同一IDは古い方を除去し、各IDが最大1回だけ存在する。
 * コンポーネント外で保持するためリマウントでリセットされない。
 */
const editorHistory = {
  stack: [],   // [{ mode, id }, ...]
  cursor: -1,  // 現在位置（-1 = 現在のページはスタック外）
  navigating: false,  // goBack/goForward による遷移中フラグ（push抑制用）

  push(mode, id) {
    // 戻る/進む中の場合、カーソルより先を切り捨て
    if (this.cursor >= 0 && this.cursor < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.cursor + 1);
    }
    // 重複除去: 古い同一IDを削除
    this.stack = this.stack.filter((e) => e.id !== id);
    this.stack.push({ mode, id });
    this.cursor = this.stack.length - 1;
  },

  canGoBack() {
    return this.cursor > 0;
  },

  canGoForward() {
    return this.cursor < this.stack.length - 1;
  },

  goBack() {
    if (!this.canGoBack()) return null;
    this.cursor--;
    this.navigating = true;
    return this.stack[this.cursor];
  },

  goForward() {
    if (!this.canGoForward()) return null;
    this.cursor++;
    this.navigating = true;
    return this.stack[this.cursor];
  },

  clear() {
    this.stack = [];
    this.cursor = -1;
    this.navigating = false;
  },
};

/**
 * 履歴エントリのエディタURLを返す。
 * asset だけ URL とモード名が異なるため、遷移する側で毎回書かずに済むよう共通化する。
 */
function editorHistoryURL(entry) {
  const urlMode = entry.mode === 'asset' ? 'assets' : entry.mode;
  return "/editor/" + urlMode + "/" + entry.id;
}

/**
 * エディタ閲覧履歴の可否を別ウィンドウのプレビューへ通知する。
 * editorHistory は React の状態ではないため、変化した時点で明示的に送る。
 */
function emitHistoryState() {
  Events.Emit('binder:editor:historyState', {
    canBack: editorHistory.canGoBack(),
    canForward: editorHistory.canGoForward(),
  });
}

export { editorHistory, editorHistoryURL, emitHistoryState };
