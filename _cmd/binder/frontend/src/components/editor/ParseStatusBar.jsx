import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import { useTranslation } from 'react-i18next';

import { ActionButton } from "../../dialogs/components/ActionButton";

import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/**
 * プレビューの下に出すステータスバー。
 * 左: 変換の状態（処理中 / 成功 / 警告 / エラー）。ダブルクリックで詳細を開く
 * 右: 文字数（選択していればその文字数も）と保存の状態
 *
 * @param {{status: string, err: any, warnings: string[], ms?: number}} parseStatus
 * @param {number} selectionChars 選んでいる範囲の文字数
 * @param {number} totalChars 全体の文字数
 * @param {null|"saving"|"saved"|"error"} saveState
 */
function ParseStatusBar({ parseStatus, selectionChars, totalChars, saveState, onShowError, onShowWarnings }) {
  const { t } = useTranslation();

  return (
    <div id="parseStatusBar">
      <div className="parseStatusLeft" onDoubleClick={() => {
        if (parseStatus.err) onShowError();
        else if (parseStatus.warnings?.length > 0) onShowWarnings();
      }}>
        {parseStatus.status === "error"
          ? <><ErrorIcon sx={{ fontSize: '16px', color: 'var(--accent-red)', mr: '6px' }} /><span className="parseStatusText">{t("preview.parseError")}</span></>
          : parseStatus.status === "warning"
          ? <><WarningAmberIcon sx={{ fontSize: '16px', color: 'var(--accent-warning, orange)', mr: '6px' }} /><span className="parseStatusText">Warning ({parseStatus.warnings?.length})</span></>
          : parseStatus.status === "processing"
          ? <><AutorenewIcon sx={{ fontSize: '16px', color: 'var(--text-muted)', mr: '6px', animation: 'spin 1s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} /><span className="parseStatusText">Processing...</span></>
          : <><CheckCircleIcon sx={{ fontSize: '16px', color: 'var(--accent-green)', mr: '6px' }} /><span className="parseStatusText">Success{parseStatus.ms != null ? ` (${parseStatus.ms}ms)` : ''}</span></>
        }
      </div>
      <div className="parseStatusRight">
        <span className="parseStatusText">
          {selectionChars > 0
            ? t("editor.charCountSelected", { selected: selectionChars.toLocaleString(), total: totalChars.toLocaleString() })
            : t("editor.charCount", { total: totalChars.toLocaleString() })}
        </span>
        {saveState && (
          <span className={"parseStatusText saveState" + (saveState === "error" ? " saveStateError" : "")}>
            {t(saveState === "saving" ? "editor.saving" : saveState === "saved" ? "editor.saved" : "editor.saveFailed")}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * 変換のエラー・警告の詳細ダイアログ。
 * 開くきっかけはステータスバーのほかにもある（エラー行のダブルクリック）ので、開閉は呼び出し側が持つ。
 */
function ParseDialogs({ parseStatus, errorOpen, warningOpen, onCloseError, onCloseWarning }) {
  const { t } = useTranslation();

  return (<>
    {/** パースエラー詳細ダイアログ */}
    <Dialog open={errorOpen} onClose={onCloseError}>
      <DialogTitle>Parse Error</DialogTitle>
      <DialogContent>
        <DialogContentText className="messageTxt">
          {parseStatus.err ? String(parseStatus.err) : ""}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <ActionButton variant="cancel" label={t("common.close")} icon={<CloseIcon />} onClick={onCloseError} />
      </DialogActions>
    </Dialog>

    {/** テンプレート関数警告ダイアログ */}
    <Dialog open={warningOpen} onClose={onCloseWarning} maxWidth="sm" fullWidth>
      <DialogTitle>Warnings ({parseStatus.warnings?.length || 0})</DialogTitle>
      <DialogContent>
        {(parseStatus.warnings || []).map((w, i) => (
          <DialogContentText key={i} className="messageTxt" sx={{ fontSize: '13px', mb: '4px', color: 'var(--text-secondary)' }}>
            {w}
          </DialogContentText>
        ))}
      </DialogContent>
      <DialogActions>
        <ActionButton variant="cancel" label={t("common.close")} icon={<CloseIcon />} onClick={onCloseWarning} />
      </DialogActions>
    </Dialog>
  </>);
}

export default ParseStatusBar;
export { ParseDialogs };
