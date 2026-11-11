import { useState } from "react";
import { IconButton, Menu, MenuItem, Select, Tooltip, Divider } from "@mui/material";
import { useTranslation } from 'react-i18next';

import { ToolbarDivider } from "./ToolbarMenus.jsx";

import DownloadIcon from '@mui/icons-material/Download';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import PreviewIcon from '@mui/icons-material/Preview';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import ContrastIcon from '@mui/icons-material/Contrast';
import CodeOffIcon from '@mui/icons-material/CodeOff';

// テンプレートのプレビュー対象を選ぶ Select の見た目
const selectSx = { minWidth: 120, height: "26px", fontSize: "0.78rem", color: "var(--text-primary)", "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border-strong)" }, "& .MuiSelect-select": { padding: "2px 8px" } };

/** テンプレートのプレビュー対象（ノート・相手のテンプレート・ダイアグラム）を選ぶ Select */
function PreviewSelect({ value, items, onChange, sx }) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      size="small"
      displayEmpty
      sx={{ ...selectSx, ...sx }}
    >
      {items.map((item) => (
        <MenuItem key={item.id} value={item.id} sx={{ fontSize: "0.8rem" }}>{item.name}</MenuItem>
      ))}
    </Select>
  );
}

/**
 * プレビューの上に出すツールバー。
 * 左: テンプレート編集時の、プレビューに使う対象の選択
 *     （ダイアグラムのテンプレートならダイアグラム、それ以外なら相手のテンプレートとノート）
 * 右: スクリプト停止の印 / カラースキーム切替 / ダウンロード / その他メニュー（別ウィンドウ・公開・非公開）
 *
 * 持つ状態は「その他メニュー」の開閉だけ。
 *
 * @param {boolean} isNote ノートを編集しているか
 * @param {boolean} isTemplate テンプレートを編集しているか
 * @param {string} templateType テンプレートの種類（layout / content / diagram）
 * @param {Array} previewOtherTemplates 相手側のテンプレート（layout を編集中なら content の一覧）
 */
function PreviewToolbar({
  isNote, isTemplate, templateType,
  previewDiagrams, previewDiagramId, onPreviewDiagramChange,
  previewOtherTemplates, previewOtherTemplateId, onPreviewOtherTemplateChange,
  previewNotes, previewNoteId, onPreviewNoteChange,
  scriptsBlocked, onScriptsBlockedClick,
  colorSchemeConfig, colorSchemeIndex, onNextColorScheme,
  onDownload, onDownloadZip,
  onOpenPreviewWindow,
  onPublish, publishDisabled,
  onOpenInBrowser, openInBrowserDisabled,
  onUnpublish,
}) {
  const { t } = useTranslation();
  const [moreAnchor, setMoreAnchor] = useState(null);
  const closeMore = () => setMoreAnchor(null);

  const isDiagramTemplate = isTemplate && templateType === "diagram";

  return (<>
    <div id="previewMenu">
      {isTemplate && (isDiagramTemplate
        ? (
          <div className="previewMenuLeft">
            <PreviewSelect value={previewDiagramId} items={previewDiagrams} onChange={onPreviewDiagramChange} />
          </div>
        ) : (
          <div className="previewMenuLeft">
            <PreviewSelect value={previewOtherTemplateId} items={previewOtherTemplates} onChange={onPreviewOtherTemplateChange} sx={{ mr: '6px' }} />
            <PreviewSelect value={previewNoteId} items={previewNotes} onChange={onPreviewNoteChange} />
          </div>
        ))}
      {!isTemplate && <div className="previewMenuLeft" />}
      <div className="previewMenuRight">
        {scriptsBlocked && (isNote || (isTemplate && !isDiagramTemplate)) &&
          <Tooltip title={t("preview.scriptsBlocked")} placement="bottom">
            <IconButton size="small" aria-label="scripts-blocked" className="editorBtn" onClick={onScriptsBlockedClick}>
              <CodeOffIcon sx={{ fontSize: '16px', color: 'var(--accent-orange)' }} />
            </IconButton>
          </Tooltip>
        }
        {colorSchemeConfig && colorSchemeConfig.values.length > 0 &&
          <Tooltip title={`${t("preview.colorScheme")}: ${colorSchemeConfig.values[colorSchemeIndex]}`} placement="bottom">
            <IconButton size="small" aria-label="color-scheme" className="editorBtn" onClick={onNextColorScheme}>
              <ContrastIcon sx={{ fontSize: '16px' }} />
            </IconButton>
          </Tooltip>
        }
        {!isTemplate &&
          <Tooltip title={t("preview.download")} placement="bottom">
            <IconButton size="small" aria-label="download" onClick={onDownload} className="editorBtn">
              <DownloadIcon sx={{ fontSize: '16px' }} />
            </IconButton>
          </Tooltip>
        }
        {isNote &&
          <Tooltip title={t("preview.downloadZip")} placement="bottom">
            <IconButton size="small" aria-label="download-zip" onClick={onDownloadZip} className="editorBtn">
              <FolderZipIcon sx={{ fontSize: '16px' }} />
            </IconButton>
          </Tooltip>
        }
        {!isTemplate && <ToolbarDivider />}
        {!isTemplate &&
          <IconButton
            size="small"
            onClick={(e) => setMoreAnchor(e.currentTarget)}
            sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--text-primary)' }, padding: '5px 0px' }}
          >
            <MoreVertIcon sx={{ fontSize: '18px' }} />
          </IconButton>
        }
      </div>
    </div>

    {/** プレビューの「その他」メニュー */}
    <Menu
      open={Boolean(moreAnchor)}
      anchorEl={moreAnchor ?? undefined}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      onClose={closeMore}
      slotProps={{ paper: { sx: { minWidth: 160 } } }}
    >
      <MenuItem onClick={() => { closeMore(); onOpenPreviewWindow(); }} disabled={isTemplate}>
        <PreviewIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("preview.openPreviewWindow")}
      </MenuItem>
      <Divider />
      <MenuItem onClick={() => { closeMore(); onPublish(); }} disabled={publishDisabled}>
        <PublishIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("preview.publish")}
      </MenuItem>
      <MenuItem onClick={() => { closeMore(); onOpenInBrowser(); }} disabled={openInBrowserDisabled}>
        <OpenInBrowserIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("tree.openBrowser")}
      </MenuItem>
      <Divider />
      <MenuItem onClick={() => { closeMore(); onUnpublish(); }}>
        <UnpublishedIcon sx={{ fontSize: '14px', mr: 1, verticalAlign: 'middle' }} />{t("preview.unpublish")}
      </MenuItem>
    </Menu>
  </>);
}

export default PreviewToolbar;
