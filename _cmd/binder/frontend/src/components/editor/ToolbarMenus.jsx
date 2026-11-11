import { useState, useEffect, useRef } from "react";
import { IconButton, Menu, MenuItem, Tooltip, Divider } from "@mui/material";
import { useTranslation } from 'react-i18next';

import { GetBinderTree } from "../../../bindings/binder/api/app";
import { extractHeadings } from "@shared/editor/outline";
import { ALERT_TYPES } from "@shared/editor/alerts";
import { getCaretPosition } from "@shared/editor/caret-position";
import { flattenStructures, sortIdCandidates } from "./tree-flatten";

import TocIcon from '@mui/icons-material/Toc';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import NewLabelIcon from '@mui/icons-material/NewLabel';
import AnnouncementOutlinedIcon from '@mui/icons-material/AnnouncementOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FontDownloadIcon from '@mui/icons-material/FontDownload';
import LaunchIcon from '@mui/icons-material/Launch';
import DownloadIcon from '@mui/icons-material/Download';

/**
 * エディタのツールバーに並ぶ「ボタン + メニュー」の部品。
 * メニューの開閉はそれぞれの部品が持つ。エディタ本体へは「何を選んだか」だけを返す。
 *
 * ボタン・項目の onMouseDown で preventDefault するのは、フォーカスを textarea に残して
 * 選択範囲（挿入位置）を保つため。
 */

// メニューの見た目（挿入系で共通）
const menuPaperSx = { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-input)' };
const menuItemSx = { fontSize: '13px', '&:hover': { backgroundColor: 'var(--hover-menuitem)' } };

/** ツールバーの縦の区切り線 */
export function ToolbarDivider() {
  return <span style={{ display: 'inline-block', width: '1px', height: '16px', backgroundColor: 'var(--border-primary)', margin: '0 6px', verticalAlign: 'middle' }} />;
}

/**
 * アウトライン（見出しの一覧）。開いたとき、カーソルがある見出しを選んだ状態にする。
 *
 * @param {string} text textarea が無いときに使う本文
 * @param {{current: number}} cursorLineRef カーソル行（1始まり）
 * @param {(line: number) => void} onJump 選んだ見出しの行
 */
export function OutlineButton({ text, cursorLineRef, onJump }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState(null);
  const [outline, setOutline] = useState([]);
  // 一覧を開いたときにカーソルがある見出しの行
  const [current, setCurrent] = useState(0);

  const open = (el) => {
    const textarea = document.querySelector("#editor");
    const headings = extractHeadings(textarea ? textarea.value : text);
    const cur = headings.filter((h) => h.line <= cursorLineRef.current).pop();
    setOutline(headings);
    setCurrent(cur ? cur.line : 0);
    setAnchor(el);
  };

  return (<>
    <Tooltip title={t("editor.outline")} placement="bottom">
      <IconButton size="small" edge="start" color="inherit" aria-label="outline" sx={{ mr: 2 }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => open(e.currentTarget)}
        className="editorBtn">
        <TocIcon fontSize="small" />
      </IconButton>
    </Tooltip>
    <Menu
      anchorEl={anchor}
      open={Boolean(anchor)}
      onClose={() => setAnchor(null)}
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      PaperProps={{ sx: { ...menuPaperSx, maxHeight: 400, maxWidth: 360 } }}
    >
      {outline.length === 0
        ? <MenuItem disabled sx={{ fontSize: '13px' }}>{t("editor.outlineEmpty")}</MenuItem>
        : outline.map((h) => (
          <MenuItem key={h.line}
            selected={h.line === current}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setAnchor(null); onJump(h.line); }}
            sx={{
              fontSize: '13px',
              pl: `${16 + (h.level - 1) * 14}px`,
              '&:hover': { backgroundColor: 'var(--hover-menuitem)' },
              '&.Mui-selected': { backgroundColor: 'var(--hover-menuitem)' },
            }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.text}</span>
          </MenuItem>
        ))}
    </Menu>
  </>);
}

/**
 * スニペット挿入。Ctrl+Shift+O でも開く（カーソルの位置に出す。位置が取れなければボタンの下）。
 * スニペットが無ければ何も描かないが、ショートカットは受け続ける。
 *
 * @param {Array<{id, name, body}>} snippets
 * @param {(body: string) => void} onInsert
 */
export function SnippetButton({ snippets, onInsert }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState(null);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        const p = getCaretPosition(document.querySelector("#editor"));
        if (p) {
          setPos(p);
          setAnchor(null);
        } else if (btnRef.current) {
          setAnchor(btnRef.current);
          setPos(null);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (snippets.length === 0) return null;

  const close = () => { setAnchor(null); setPos(null); };

  return (<>
    <ToolbarDivider />
    <Tooltip title={t("editor.insertSnippet") + " (Ctrl+Shift+O)"} placement="bottom">
      <IconButton ref={btnRef} size="small" edge="start" color="inherit" aria-label="snippet" sx={{ mr: 2 }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => { setAnchor(e.currentTarget); setPos(null); }}
        className="editorBtn">
        <PlaylistAddIcon fontSize="small" />
      </IconButton>
    </Tooltip>
    <Menu
      anchorEl={anchor}
      anchorReference={pos ? 'anchorPosition' : 'anchorEl'}
      anchorPosition={pos || undefined}
      open={Boolean(anchor) || Boolean(pos)}
      onClose={close}
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      PaperProps={{ sx: { ...menuPaperSx, maxHeight: 300 } }}
    >
      {snippets.map((s) => (
        <MenuItem key={s.id}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onInsert(s.body); close(); }}
          sx={menuItemSx}>
          {s.name}
        </MenuItem>
      ))}
    </Menu>
  </>);
}

/**
 * ID 挿入。Ctrl+T でも開く（カーソルの位置に出す。位置が取れなければボタンの下）。
 * 一覧は開くたびにツリーから作る（子を優先し、更新日付の降順。自分自身は出さない）。
 *
 * @param {string} currentId 開いているものの ID
 * @param {(item: object) => void} onInsert 選んだ Structure
 * @param {(err: any) => void} onError
 */
export function IdInsertButton({ currentId, onInsert, onError }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState(null);
  const [pos, setPos] = useState(null);
  const [list, setList] = useState([]);
  const btnRef = useRef(null);

  const load = () => GetBinderTree().then((tree) => {
    const all = flattenStructures(tree.data || []);
    setList(sortIdCandidates(all, currentId));
  });

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        const p = getCaretPosition(document.querySelector("#editor"));
        load().then(() => {
          if (p) {
            setPos(p);
            setAnchor(null);
          } else if (btnRef.current) {
            setAnchor(btnRef.current);
            setPos(null);
          }
        }).catch((err) => onError(err));
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [currentId]);

  const close = () => { setAnchor(null); setPos(null); };

  return (<>
    <Tooltip title={t("editor.insertId") + " (Ctrl+T)"} placement="bottom">
      <IconButton ref={btnRef} size="small" edge="start" color="inherit" aria-label="insert-id" sx={{ mr: 2 }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          const el = e.currentTarget;
          load().then(() => {
            setAnchor(el);
            setPos(null);
          }).catch((err) => onError(err));
        }}
        className="editorBtn">
        <NewLabelIcon fontSize="small" />
      </IconButton>
    </Tooltip>
    <Menu
      anchorEl={anchor}
      anchorReference={pos ? 'anchorPosition' : 'anchorEl'}
      anchorPosition={pos || undefined}
      open={Boolean(anchor) || Boolean(pos)}
      onClose={close}
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      PaperProps={{ sx: { ...menuPaperSx, maxHeight: 300 } }}
    >
      {list.map((s) => (
        <MenuItem key={s.id}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onInsert(s); close(); }}
          sx={menuItemSx}>
          {s.name}
        </MenuItem>
      ))}
    </Menu>
  </>);
}

/**
 * 囲み（GitHub Alerts）の挿入。プラグインが効いているときだけ呼び出し側が出す。
 *
 * @param {(type: string) => void} onInsert
 */
export function AlertsButton({ onInsert }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState(null);

  return (<>
    <Tooltip title={t("editor.alerts")} placement="bottom">
      <IconButton size="small" edge="start" color="inherit" aria-label="alerts" sx={{ mr: 2 }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => setAnchor(e.currentTarget)}
        className="editorBtn">
        <AnnouncementOutlinedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
    <Menu
      anchorEl={anchor}
      open={Boolean(anchor)}
      onClose={() => setAnchor(null)}
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      PaperProps={{ sx: menuPaperSx }}
    >
      {ALERT_TYPES.map((a) => (
        <MenuItem key={a.type}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setAnchor(null); onInsert(a.type); }}
          sx={menuItemSx}>
          {a.icon} {a.type}
        </MenuItem>
      ))}
    </Menu>
  </>);
}

/**
 * エディタの「その他」メニュー（フォント・外部エディタ・テキストのダウンロード）。
 *
 * @param {boolean} canDownload テキストをダウンロードできるか（ノート・ダイアグラム）
 */
export function EditorMoreButton({ canDownload, onFontDialog, onRunEditor, onDownloadRaw, onDownloadExpanded }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState(null);
  // テキストダウンロードのサブメニューのアンカー
  const [downloadAnchor, setDownloadAnchor] = useState(null);

  const close = () => { setAnchor(null); setDownloadAnchor(null); };

  return (<>
    <Tooltip title={t("editor.menu")} placement="bottom">
      <IconButton
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--text-primary)' }, padding: '5px 0px' }}
        className="editorBtn"
      >
        <MoreVertIcon sx={{ fontSize: '18px' }} />
      </IconButton>
    </Tooltip>

    <Menu
      open={Boolean(anchor)}
      anchorEl={anchor ?? undefined}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      onClose={close}
      slotProps={{ paper: { sx: { minWidth: 160 } } }}
    >
      <MenuItem onClick={() => { close(); onFontDialog(); }}>
        <FontDownloadIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("editor.fontSetting")}
      </MenuItem>
      <MenuItem onClick={() => { close(); onRunEditor(); }}>
        <LaunchIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("editor.openExternalEditor")}
      </MenuItem>
      {canDownload && <Divider />}
      {canDownload && (
        <MenuItem onClick={(e) => { e.stopPropagation(); setDownloadAnchor(e.currentTarget); }} sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><DownloadIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.download")}</span><span>▶</span>
        </MenuItem>
      )}
    </Menu>

    {/** テキストダウンロードサブメニュー */}
    <Menu
      open={Boolean(downloadAnchor)}
      onClose={close}
      anchorEl={downloadAnchor}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { minWidth: 180 } } }}
    >
      <MenuItem onClick={() => { close(); onDownloadRaw(); }}>{t("tree.downloadText")}</MenuItem>
      <MenuItem onClick={() => { close(); onDownloadExpanded(); }}>{t("tree.downloadExpanded")}</MenuItem>
    </Menu>
  </>);
}
