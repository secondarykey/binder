import PropTypes from 'prop-types';
import { Menu, MenuItem, Divider } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import LaunchIcon from '@mui/icons-material/Launch';
import { useTranslation } from 'react-i18next';

/**
 * プレビュー用のコンテキストメニュー。
 *
 * WebView 既定のメニューは「リンクを開く」「戻る」を持ち、プレビューを
 * 意図せず遷移させられるため HTMLFrame 側で止めている。その代わりに、
 * プレビューで意味のある操作だけをここに並べる。
 *
 * 「戻る」は WebView のフレーム履歴ではなくエディタの閲覧履歴を辿る。
 * リンクで別のエントリへ移動したあと元のエントリへ戻る、という導線のため。
 *
 * Props:
 *   state          - HTMLFrame の onContextMenu が渡す情報 + open と履歴の可否
 *                    { open, x, y, kind, href, selection, canBack, canForward }
 *   onClose        - メニューを閉じる
 *   onBack         - エディタ履歴を戻る（未指定なら項目を出さない）
 *   onForward      - エディタ履歴を進む（未指定なら項目を出さない）
 *   onCopy         - 選択テキストのコピー（未指定なら項目を出さない）
 *   onCopyLink     - リンクURLのコピー（未指定なら項目を出さない）
 *   onOpenExternal - 外部リンクをブラウザで開く（未指定なら項目を出さない）
 *   onOpenInternal - バインダー内リンクをエディタで開く（未指定なら項目を出さない）
 */
const ICON_SX = { fontSize: '14px', mr: 1, verticalAlign: 'middle' };

function PreviewContextMenu({ state, onClose, onBack, onForward, onCopy, onCopyLink, onOpenExternal, onOpenInternal }) {

  const { t } = useTranslation();

  const selection = state?.selection ?? '';
  const href = state?.href ?? '';
  const kind = state?.kind ?? null;
  const isLink = !!href && (kind === 'external' || kind === 'internal');

  const hasHistory = !!onBack || !!onForward;

  const run = (fn, arg) => () => {
    onClose?.();
    fn(arg);
  };

  return (
    <Menu
      open={!!state?.open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: state?.y ?? 0, left: state?.x ?? 0 }}
      slotProps={{ paper: { sx: { minWidth: 180 } } }}
    >
      {/** 戻る/進む はブラウザと同じ位置（先頭）に置く */}
      {onBack &&
        <MenuItem onClick={run(onBack)} disabled={!state?.canBack}>
          <ArrowBackIosNewIcon sx={ICON_SX} />{t('editor.historyBack')}
        </MenuItem>
      }
      {onForward &&
        <MenuItem onClick={run(onForward)} disabled={!state?.canForward}>
          <ArrowForwardIosIcon sx={ICON_SX} />{t('editor.historyForward')}
        </MenuItem>
      }
      {hasHistory && <Divider />}

      {/** 選択が無いときも項目自体は見せる（何ができるメニューなのか分かるように） */}
      {onCopy &&
        <MenuItem onClick={run(onCopy, selection)} disabled={!selection}>
          <ContentCopyIcon sx={ICON_SX} />{t('preview.contextMenu.copy')}
        </MenuItem>
      }

      {isLink && onCopyLink && <Divider />}
      {isLink && onCopyLink &&
        <MenuItem onClick={run(onCopyLink, href)}>
          <LinkIcon sx={ICON_SX} />{t('preview.contextMenu.copyLink')}
        </MenuItem>
      }
      {kind === 'external' && onOpenExternal &&
        <MenuItem onClick={run(onOpenExternal, href)}>
          <OpenInBrowserIcon sx={ICON_SX} />{t('preview.contextMenu.openInBrowser')}
        </MenuItem>
      }
      {kind === 'internal' && onOpenInternal &&
        <MenuItem onClick={run(onOpenInternal, href)}>
          <LaunchIcon sx={ICON_SX} />{t('preview.contextMenu.openEntry')}
        </MenuItem>
      }
    </Menu>
  );
}

PreviewContextMenu.propTypes = {
  state: PropTypes.shape({
    open: PropTypes.bool,
    x: PropTypes.number,
    y: PropTypes.number,
    kind: PropTypes.string,
    href: PropTypes.string,
    selection: PropTypes.string,
    canBack: PropTypes.bool,
    canForward: PropTypes.bool,
  }),
  onClose: PropTypes.func,
  onBack: PropTypes.func,
  onForward: PropTypes.func,
  onCopy: PropTypes.func,
  onCopyLink: PropTypes.func,
  onOpenExternal: PropTypes.func,
  onOpenInternal: PropTypes.func,
};

export default PreviewContextMenu;
