import { createContext, useCallback, useContext } from "react";
import { EventContext } from "../../Event";
import { parseError } from "../../error";

/**
 * ダイアログスコープのエラーコンテキスト
 * ModalWrapper / MetaDialog が提供し、子コンポーネントへ伝播する
 * value: { setMsg: ({severity, text}) => void, clearMsg: () => void }
 */
export const DialogErrorContext = createContext(null);

/**
 * エラー/警告メッセージをダイアログ内またはSnackbarに振り分けるフック
 * - DialogErrorContext が存在する（ModalWrapper/MetaDialog の内側）→ インライン Alert
 * - 存在しない（ダイアログ外）→ 従来の Snackbar フォールバック
 */
export function useDialogMessage() {
    const ctx = useContext(DialogErrorContext);
    const evt = useContext(EventContext);

    const showError = useCallback((err) => {
        // インライン Alert はユーザ向けの body のみ表示する。
        // Go 側が kind を指定している場合はそちらを severity に使う。
        const { body, kind } = parseError(err);
        const severity = kind || 'error';
        if (ctx) ctx.setMsg({ severity, text: body });
        else evt.showErrorMessage(err);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx, evt]);

    const showWarning = useCallback((msg) => {
        if (ctx) ctx.setMsg({ severity: 'warning', text: msg });
        else evt.showWarningMessage(msg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx, evt]);

    return { showError, showWarning };
}
