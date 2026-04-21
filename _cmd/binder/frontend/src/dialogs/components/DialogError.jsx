import { createContext, useCallback, useContext } from "react";
import { EventContext } from "../../Event";

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

    const normalize = (err) => {
        if (typeof err === 'object') return err?.stack || String(err) || 'Unknown error';
        return err || 'Unknown error';
    };

    const showError = useCallback((err) => {
        const text = normalize(err);
        if (ctx) ctx.setMsg({ severity: 'error', text });
        else evt.showErrorMessage(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx, evt]);

    const showWarning = useCallback((msg) => {
        if (ctx) ctx.setMsg({ severity: 'warning', text: msg });
        else evt.showWarningMessage(msg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx, evt]);

    return { showError, showWarning };
}
