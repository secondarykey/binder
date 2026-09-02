import PropTypes from 'prop-types';
import { Menu, MenuItem, Divider } from '@mui/material';
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
 * Props:
 *   state          - HTMLFrame の onContextMenu が渡す情報 + open
 *                    { open, x, y, kind, href, selection }
 *   onClose        - メニューを閉じる
 *   onCopy         - 選択テキストのコピー（未指定なら項目を出さない）
 *   onCopyLink     - リンクURLのコピー（未指定なら項目を出さない）
 *   onOpenExternal - 外部リンクをブラウザで開く（未指定なら項目を出さない）
 *   onOpenInternal - バインダー内リンクをエディタで開く（未指定なら項目を出さない）
 */
const ICON_SX = { fontSize: '14px', mr: 1, verticalAlign: 'middle' };

function PreviewContextMenu({ state, onClose, onCopy, onCopyLink, onOpenExternal, onOpenInternal }) {

  const { t } = useTranslation();

  const selection = state?.selection ?? '';
  const href = state?.href ?? '';
  const kind = state?.kind ?? null;
  const isLink = !!href && (kind === 'external' || kind === 'internal');

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
  }),
  onClose: PropTypes.func,
  onCopy: PropTypes.func,
  onCopyLink: PropTypes.func,
  onOpenExternal: PropTypes.func,
  onOpenInternal: PropTypes.func,
};

export default PreviewContextMenu;
