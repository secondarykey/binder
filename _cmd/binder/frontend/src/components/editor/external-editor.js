// プロセスがこれより早く終わったら、起動だけして終わるエディタ（VS Code の code など）とみなす
export const QUICK_EXIT_MS = 5000;

/**
 * 外部エディタを起動し、終わるまでファイルの変更を読み込み続ける。
 *
 * 起動だけしてすぐ終わるエディタでは、保存はプロセスが終わったあとに行われる。
 * その場合は onDetach を呼んで読み込みを続け、finish() が呼ばれたら終える。
 *
 * run      エディタを起動し、プロセスが終わると解決する Promise を返す
 * read     ファイルの中身を返す Promise を返す。null なら読み込まない
 * onText   読み込んだ中身が変わったとき
 * onDetach プロセスがすぐに終わり、finish() を待つようになったとき
 * onFinish 終えたとき（エラーのときも呼ぶ）
 * onError  起動・最後の読み込みに失敗したとき
 *
 * 戻り値の finish() で編集を終え、stop() で読み込みだけを止める（画面を閉じるとき）。
 */
export function watchExternalEditor({
  run, read, initialText, onText, onDetach, onFinish, onError,
  intervalMs = 2000, quickExitMs = QUICK_EXIT_MS, now = Date.now,
}) {
  let last = initialText;
  let finished = false;

  const timer = setInterval(() => {
    if (!read) return;
    read().then((resp) => {
      if (!finished && resp !== last) {
        last = resp;
        onText(resp);
      }
    }).catch(() => {});
  }, intervalMs);

  const stop = () => {
    finished = true;
    clearInterval(timer);
  };

  const finish = () => {
    if (finished) return;
    stop();
    // 最後の保存を取りこぼさないよう読み直す
    if (read) {
      read().then(onText).catch(onError);
    }
    onFinish();
  };

  const started = now();
  run().then(() => {
    if (finished) return;
    if (now() - started < quickExitMs) {
      onDetach();
      return;
    }
    finish();
  }).catch((err) => {
    if (finished) return;
    stop();
    onError(err);
    onFinish();
  });

  return { finish, stop };
}
