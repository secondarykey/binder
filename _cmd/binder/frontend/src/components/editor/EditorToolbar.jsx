import { Container, IconButton, ToggleButton, Tooltip } from "@mui/material";
import { useTranslation } from 'react-i18next';

import { ToolbarDivider, OutlineButton, SnippetButton, IdInsertButton, AlertsButton, EditorMoreButton } from "./ToolbarMenus.jsx";

import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import CodeIcon from '@mui/icons-material/Code';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import WrapTextIcon from '@mui/icons-material/WrapText';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TableChartIcon from '@mui/icons-material/TableChart';

/**
 * 表示の切り替え（行番号・折り返し・プレビュー）のトグル。
 * gap は右隣のトグルとの間を空けるか。
 */
function ToolbarToggle({ title, value, selected, onChange, gap, children }) {
  return (
    <Tooltip title={title} placement="bottom">
      <ToggleButton
        value={value}
        selected={selected}
        size="small"
        onChange={onChange}
        sx={{
          border: 'none',
          borderRadius: '4px',
          padding: '4px',
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
          '&.Mui-selected': {
            backgroundColor: 'rgba(255,255,255,0.08)',
            color: 'var(--text-primary)',
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.14)' },
          },
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
          ...(gap ? { mr: '2px' } : {}),
        }}
      >
        {children}
      </ToggleButton>
    </Tooltip>
  );
}

/**
 * 選んだ文字を記号で挟む・行頭に付けるボタン。
 * onMouseDown の preventDefault で、フォーカスと選択範囲を textarea に残す。
 */
function FormatButton({ title, label, onClick, children }) {
  return (
    <Tooltip title={title} placement="bottom">
      <IconButton size="small" edge="start" color="inherit" aria-label={label} sx={{ mr: 2 }} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="editorBtn">
        {children}
      </IconButton>
    </Tooltip>
  );
}

/**
 * テキスト編集エリアの上に出すツールバー。
 * 左: 行番号 / アウトライン / スニペット / ID 挿入 / 書式 / 囲み / 表の編集
 * 右: 折り返し / プレビュー表示 / その他メニュー
 *
 * 状態は持たない（メニューの開閉は ToolbarMenus の各部品が持つ）。
 * 何をするかはすべてエディタ本体（Component.jsx）から受け取る。
 *
 * @param {boolean} isNote ノートを編集しているか（書式・アウトラインはノートだけ）
 * @param {boolean} canDownload テキストをダウンロードできるか（ノート・ダイアグラム）
 * @param {(s: string, e?: string) => void} onInsert 選択を s と e で挟む（e が無ければ各行の頭に s）
 */
function EditorToolbar({
  isNote, canDownload,
  showLineNumbers, onToggleLineNumbers,
  wordWrap, onToggleWordWrap,
  viewer, onToggleViewer,
  text, cursorLineRef, onJumpToLine,
  snippets, onInsertSnippet,
  currentId, onInsertId, onError,
  onInsert,
  alertsAvailable, onInsertAlert,
  onTableEdit,
  onFontDialog, onRunEditor, onDownloadRaw, onDownloadExpanded,
}) {
  const { t } = useTranslation();

  return (
    <Container id="editorMenu">
      <Container className="buttonBarLeft">

        {/** 行番号表示トグル */}
        <ToolbarToggle title={showLineNumbers ? t("editor.lineNumberOn") : t("editor.lineNumberOff")}
          value="lineNumbers" selected={showLineNumbers} onChange={onToggleLineNumbers} gap>
          <FormatListNumberedIcon sx={{ fontSize: '16px' }} />
        </ToolbarToggle>

        {/** アウトライン（ノート編集時のみ表示） */}
        {isNote && <OutlineButton text={text} cursorLineRef={cursorLineRef} onJump={onJumpToLine} />}

        {/** スニペット挿入 */}
        <SnippetButton snippets={snippets} onInsert={onInsertSnippet} />

        {/** ID挿入 */}
        <IdInsertButton currentId={currentId} onInsert={onInsertId} onError={onError} />

        {/** マークダウン書式ボタン（ノート編集時のみ表示） */}
        {isNote && <>
          <ToolbarDivider />

          <FormatButton title={`${t("editor.bold")} (Ctrl+B)`} label="bold" onClick={() => onInsert("**", "**")}>
            <FormatBoldIcon fontSize="small" />
          </FormatButton>

          <FormatButton title={`${t("editor.italic")} (Ctrl+I)`} label="italic" onClick={() => onInsert("*", "*")}>
            <FormatItalicIcon fontSize="small" />
          </FormatButton>

          <FormatButton title={t("editor.strikethrough")} label="strike" onClick={() => onInsert("~~", "~~")}>
            <FormatStrikethroughIcon fontSize="small" />
          </FormatButton>

          <FormatButton title={t("editor.codeBlock")} label="code" onClick={() => onInsert("\n```\n", "\n```\n")}>
            <CodeIcon fontSize="small" />
          </FormatButton>

          <FormatButton title={t("editor.quote")} label="code" onClick={() => onInsert("> ")}>
            <FormatQuoteIcon fontSize="small" />
          </FormatButton>

          {/** 囲み（GitHub Alerts プラグインが効いているときだけ） */}
          {alertsAvailable && <AlertsButton onInsert={onInsertAlert} />}

          <ToolbarDivider />

          {/** テーブル編集 */}
          <FormatButton title={t("editor.tableEdit")} label="table-edit" onClick={onTableEdit}>
            <TableChartIcon fontSize="small" />
          </FormatButton>
        </>}

      </Container>

      <Container className="buttonBarRight">

        {/** テキスト折り返しトグル */}
        <ToolbarToggle title={wordWrap ? t("editor.wordWrapOn") : t("editor.wordWrapOff")}
          value="wordWrap" selected={wordWrap} onChange={onToggleWordWrap} gap>
          <WrapTextIcon sx={{ fontSize: '16px' }} />
        </ToolbarToggle>

        {/** プレビュー表示トグル */}
        <ToolbarToggle title={viewer ? t("editor.previewOn") : t("editor.previewOff")}
          value="viewer" selected={viewer} onChange={onToggleViewer}>
          <VisibilityIcon sx={{ fontSize: '16px' }} />
        </ToolbarToggle>

        <ToolbarDivider />

        {/** その他メニュー */}
        <EditorMoreButton canDownload={canDownload}
          onFontDialog={onFontDialog} onRunEditor={onRunEditor}
          onDownloadRaw={onDownloadRaw} onDownloadExpanded={onDownloadExpanded} />

      </Container>
    </Container>
  );
}

export default EditorToolbar;
