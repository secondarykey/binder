import { useState, useEffect, useRef } from "react";
import {
  Box, DialogActions, DialogContent, IconButton,
  TextField, ToggleButton, ToggleButtonGroup, Tooltip,
} from "@mui/material";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove,
  verticalListSortingStrategy, horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import ModalWrapper from "./components/ModalWrapper.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import { ActionButton } from "./components/ActionButton.jsx";
import "../language";
import { useTranslation } from "react-i18next";

// ────────────────────────────────────────────────────────────────
// ヘルパー関数
// ────────────────────────────────────────────────────────────────

/**
 * マークダウンテーブルをパースする
 * @param {string[]} lines
 * @returns {{ rows: string[][], aligns: string[] }}
 */
function parseMarkdownTable(lines) {
  const parseCells = (line) =>
    line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim().replace(/<br>/gi, "\n"));

  const parseAlign = (sep) => {
    const t = sep.trim();
    if (t.startsWith(":") && t.endsWith(":")) return "center";
    if (t.endsWith(":")) return "right";
    return "left";
  };

  const separatorCells = lines[1].replace(/^\||\|$/g, "").split("|");
  const aligns = separatorCells.map(parseAlign);

  // セパレータ行（lines[1]）を除いた全行をパース
  const rows = lines
    .filter((_, i) => i !== 1)
    .map(parseCells);

  // 列数を aligns に揃える（短い行は空文字で補完）
  const colCount = aligns.length;
  const normalizedRows = rows.map((row) => {
    const r = [...row];
    while (r.length < colCount) r.push("");
    return r.slice(0, colCount);
  });

  return { rows: normalizedRows, aligns };
}

/**
 * rows と aligns からマークダウンテーブル文字列を生成する
 * @param {string[][]} rows
 * @param {string[]} aligns
 * @returns {string}
 */
function generateMarkdownTable(rows, aligns) {
  const escape = (s) => s.replace(/\n/g, "<br>");

  const serializeRow = (cells) =>
    "| " + cells.map(escape).join(" | ") + " |";

  const makeAlign = (a) => {
    if (a === "center") return ":---:";
    if (a === "right") return "---:";
    return "---";
  };
  const sepRow = "| " + aligns.map(makeAlign).join(" | ") + " |";

  return [
    serializeRow(rows[0]),
    sepRow,
    ...rows.slice(1).map(serializeRow),
  ].join("\n");
}

// ────────────────────────────────────────────────────────────────
// サブコンポーネント: 列ドラッグハンドル
// ────────────────────────────────────────────────────────────────

function SortableColHandle({ id, colWidth }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });

  return (
    <Box
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      sx={{
        width: colWidth,
        flexShrink: 0,
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "28px",
        cursor: "grab",
        color: "var(--text-faint)",
        "&:active": { cursor: "grabbing" },
        border: "1px solid transparent",
        borderRadius: "2px",
        "&:hover": { border: "1px solid var(--border-subtle)" },
      }}
      {...attributes}
      {...listeners}
    >
      <DragIndicatorIcon sx={{ fontSize: "14px", transform: "rotate(90deg)" }} />
    </Box>
  );
}

// ────────────────────────────────────────────────────────────────
// サブコンポーネント: データ行（行ドラッグ対応）
// ────────────────────────────────────────────────────────────────

function SortableRow({ id, row, r, aligns, selectedCell, onCellClick, colWidth }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });

  return (
    <Box sx={{ display: "flex", alignItems: "stretch", mb: "2px" }}>
      {/* 行ドラッグハンドル */}
      <Box
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        sx={{
          width: "32px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          color: isDragging ? "var(--text-primary)" : "var(--text-faint)",
          "&:active": { cursor: "grabbing" },
        }}
        {...attributes}
        {...listeners}
      >
        <DragIndicatorIcon sx={{ fontSize: "14px" }} />
      </Box>

      {/* セル群 */}
      {row.map((cell, c) => (
        <Box
          key={c}
          onClick={() => onCellClick(r, c)}
          sx={{
            width: colWidth,
            flexShrink: 0,
            boxSizing: "border-box",
            border:
              selectedCell.r === r && selectedCell.c === c
                ? "1px solid var(--accent-blue)"
                : "1px solid var(--border-subtle)",
            borderRadius: "2px",
            p: "3px 6px",
            fontSize: "13px",
            cursor: "pointer",
            fontWeight: r === 0 ? "bold" : "normal",
            backgroundColor:
              r === 0 ? "var(--bg-elevated)" : "var(--bg-surface)",
            textAlign:
              aligns[c] === "center" ? "center"
              : aligns[c] === "right" ? "right"
              : "left",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minHeight: "28px",
            mr: "2px",
            userSelect: "none",
          }}
        >
          {cell || (
            <span style={{ color: "var(--text-faint)", fontStyle: "italic", pointerEvents: "none" }}>
              &nbsp;
            </span>
          )}
        </Box>
      ))}
    </Box>
  );
}

// ────────────────────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────────────────────

/**
 * テーブル編集ダイアログ
 * @param {{ open: boolean, tableLines: string[], onClose: (null|string) => void }} props
 */
function TableDialog({ open, tableLines, onClose }) {
  const { t } = useTranslation();

  const [rows, setRows] = useState([]);
  const [aligns, setAligns] = useState([]);
  const [selectedCell, setSelectedCell] = useState({ r: -1, c: -1 });
  const [cellText, setCellText] = useState("");
  const [confirmState, setConfirmState] = useState({ open: false, type: null, index: -1 });
  const cellInputRef = useRef(null);

  // tableLines が変わったらパース
  useEffect(() => {
    if (!open || !tableLines || tableLines.length < 2) return;
    const { rows: r, aligns: a } = parseMarkdownTable(tableLines);
    setRows(r);
    setAligns(a);
    setSelectedCell({ r: -1, c: -1 });
    setCellText("");
  }, [open, tableLines]);

  const colCount = aligns.length;
  // 列幅: 固定
  const colWidth = 84;

  // +列ボタンの幅
  const addColWidth = 30;

  // ダイアログサイズを列数・行数に合わせて動的計算
  // 横: 行ハンドル(32) + 列×(colWidth+2) + +列(addColWidth+2) + ×列(32) + 内側padding(24) + バッファ(16)
  const dialogWidth = Math.max(300, 32 + colCount * (colWidth + 2) + (addColWidth + 2) + 32 + 40);
  // 縦: ツールバー(40) + コンテンツpadding(24) + 列ドラッグ行(30) + align行(26)
  //      + データ行×n(30each) + +行(36) + ×行(34) + セル編集エリア(100) + アクション(48)
  const dialogHeight = Math.max(400, 338 + rows.length * 30);

  const rowIds = rows.map((_, i) => `row-${i}`);
  const colIds = aligns.map((_, i) => `col-${i}`);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ────────────────────────
  // セル操作
  // ────────────────────────

  const handleCellClick = (r, c) => {
    setSelectedCell({ r, c });
    setCellText(rows[r][c]);
    setTimeout(() => cellInputRef.current?.focus(), 0);
  };

  const handleCellTextChange = (value) => {
    setCellText(value);
    if (selectedCell.r < 0) return;
    const { r, c } = selectedCell;
    setRows((prev) =>
      prev.map((row, ri) =>
        ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row
      )
    );
  };

  const handleAddColumn = () => {
    setAligns((a) => [...a, "left"]);
    setRows((prev) => prev.map((row) => [...row, ""]));
    if (selectedCell.r >= 0) {
      setSelectedCell((sel) => ({ ...sel }));
    }
  };

  const handleDeleteColumn = (c) => {
    if (aligns.length <= 1) return;
    setConfirmState({ open: true, type: "col", index: c });
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, Array(colCount).fill("")]);
  };

  const handleDeleteRow = (r) => {
    if (r === 0) return;
    if (rows.length <= 2) return; // ヘッダ + 最低1データ行
    setConfirmState({ open: true, type: "row", index: r });
  };

  const handleConfirmDelete = () => {
    const { type, index } = confirmState;
    setConfirmState({ open: false, type: null, index: -1 });
    if (type === "row") {
      setRows((prev) => prev.filter((_, i) => i !== index));
      if (selectedCell.r === index) setSelectedCell({ r: -1, c: -1 });
      else if (selectedCell.r > index)
        setSelectedCell((sel) => ({ ...sel, r: sel.r - 1 }));
    } else if (type === "col") {
      setAligns((a) => a.filter((_, i) => i !== index));
      setRows((prev) => prev.map((row) => row.filter((_, i) => i !== index)));
      if (selectedCell.c === index) setSelectedCell({ r: -1, c: -1 });
      else if (selectedCell.c > index)
        setSelectedCell((sel) => ({ ...sel, c: sel.c - 1 }));
    }
  };

  const handleCancelDelete = () => {
    setConfirmState({ open: false, type: null, index: -1 });
  };

  const handleAlignChange = (c, value) => {
    setAligns((prev) => prev.map((a, i) => (i === c ? value : a)));
  };

  // ────────────────────────
  // ドラッグ
  // ────────────────────────

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);

    if (activeStr.startsWith("row-") && overStr.startsWith("row-")) {
      const from = parseInt(activeStr.slice(4));
      const to = parseInt(overStr.slice(4));
      setRows((prev) => arrayMove(prev, from, to));
      setSelectedCell((sel) => {
        if (sel.r < 0) return sel;
        if (sel.r === from) return { ...sel, r: to };
        const newR = arrayMove(
          Array.from({ length: rows.length }, (_, i) => i),
          from,
          to
        ).indexOf(sel.r);
        return { ...sel, r: newR };
      });
    } else if (activeStr.startsWith("col-") && overStr.startsWith("col-")) {
      const from = parseInt(activeStr.slice(4));
      const to = parseInt(overStr.slice(4));
      setAligns((prev) => arrayMove(prev, from, to));
      setRows((prev) => prev.map((row) => arrayMove(row, from, to)));
      setSelectedCell((sel) => {
        if (sel.c < 0) return sel;
        if (sel.c === from) return { ...sel, c: to };
        const newC = arrayMove(
          Array.from({ length: aligns.length }, (_, i) => i),
          from,
          to
        ).indexOf(sel.c);
        return { ...sel, c: newC };
      });
    }
  };

  // ────────────────────────
  // OK / キャンセル
  // ────────────────────────

  const handleClose = () => {
    onClose(generateMarkdownTable(rows, aligns));
  };

  return (
    <ModalWrapper
      open={open}
      onClose={handleClose}
      title={t("tableDialog.title")}
      width={`${dialogWidth}px`}
      height={`${dialogHeight}px`}
      maxWidth="95vw"
      maxHeight="90vh"
    >
      <DialogContent
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        {rows.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Box sx={{ overflowX: "auto", pb: 1 }}>
              {/* ─── 列ドラッグハンドル行 ─── */}
              <Box sx={{ display: "flex", alignItems: "center", mb: "2px" }}>
                <Box sx={{ width: "32px", flexShrink: 0 }} />
                <SortableContext items={colIds} strategy={horizontalListSortingStrategy}>
                  {colIds.map((cid) => (
                    <Box key={cid} sx={{ mr: "2px" }}>
                      <SortableColHandle id={cid} colWidth={colWidth} />
                    </Box>
                  ))}
                </SortableContext>
                {/* +列: データ行に縦長ボタンがあるため空欄 */}
                <Box sx={{ width: addColWidth, flexShrink: 0, mr: "2px" }} />
                {/* ×列: ヘッダ行は空欄 */}
                <Box sx={{ width: "32px", flexShrink: 0 }} />
              </Box>

              {/* ─── Align 設定行 ─── */}
              <Box sx={{ display: "flex", alignItems: "center", mb: "4px" }}>
                <Box sx={{ width: "32px", flexShrink: 0 }} />
                {aligns.map((align, c) => (
                  <Box key={c} sx={{ width: colWidth, flexShrink: 0, mr: "2px", boxSizing: "border-box", border: "1px solid transparent" }}>
                    <ToggleButtonGroup
                      value={align}
                      exclusive
                      onChange={(_, v) => { if (v) handleAlignChange(c, v); }}
                      sx={{
                        width: "100%",
                        height: "22px",
                        "& .MuiToggleButton-root": {
                          flex: 1,
                          padding: "0px",
                          minWidth: 0,
                          color: "var(--text-faint)",
                          borderColor: "var(--border-input)",
                          "&.Mui-selected": {
                            color: "var(--text-primary)",
                            backgroundColor: "rgba(255,255,255,0.10)",
                          },
                          "&:hover": { backgroundColor: "rgba(255,255,255,0.06)" },
                        },
                      }}
                    >
                      <ToggleButton value="left">
                        <Tooltip title={t("tableDialog.alignLeft")} placement="top">
                          <FormatAlignLeftIcon sx={{ fontSize: "12px" }} />
                        </Tooltip>
                      </ToggleButton>
                      <ToggleButton value="center">
                        <Tooltip title={t("tableDialog.alignCenter")} placement="top">
                          <FormatAlignCenterIcon sx={{ fontSize: "12px" }} />
                        </Tooltip>
                      </ToggleButton>
                      <ToggleButton value="right">
                        <Tooltip title={t("tableDialog.alignRight")} placement="top">
                          <FormatAlignRightIcon sx={{ fontSize: "12px" }} />
                        </Tooltip>
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                ))}
                {/* +列・×列: align行は空欄 */}
                <Box sx={{ width: addColWidth, flexShrink: 0, mr: "2px" }} />
                <Box sx={{ width: "32px", flexShrink: 0 }} />
              </Box>

              {/* ─── データ行 + +列（縦長）+ ×列（行削除）─── */}
              <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
                <Box sx={{ display: "flex", alignItems: "stretch" }}>
                  {/* 行（ハンドル＋セル） */}
                  <Box sx={{ display: "flex", flexDirection: "column" }}>
                    {rows.map((row, r) => (
                      <SortableRow
                        key={rowIds[r]}
                        id={rowIds[r]}
                        row={row}
                        r={r}
                        aligns={aligns}
                        selectedCell={selectedCell}
                        onCellClick={handleCellClick}
                        colWidth={colWidth}
                      />
                    ))}
                  </Box>

                  {/* +列: 全行にわたる縦長追加ボタン */}
                  <Tooltip title={t("tableDialog.addColumn")} placement="right">
                    <Box
                      onClick={handleAddColumn}
                      sx={{
                        width: addColWidth,
                        flexShrink: 0,
                        mr: "2px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        border: "1px dashed var(--border-subtle)",
                        borderRadius: "2px",
                        color: "var(--text-faint)",
                        "&:hover": {
                          borderColor: "var(--text-secondary, var(--text-primary))",
                          color: "var(--text-secondary, var(--text-primary))",
                        },
                      }}
                    >
                      <AddIcon sx={{ fontSize: "14px" }} />
                    </Box>
                  </Tooltip>

                  {/* ×列: 行削除ボタン（各行に1つ） */}
                  <Box sx={{ width: "32px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
                    {rows.map((_, r) => (
                      <Box
                        key={r}
                        sx={{ height: "30px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Tooltip title={t("tableDialog.deleteRow")} placement="right">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteRow(r)}
                              disabled={r === 0}
                              sx={{ padding: "2px", opacity: r === 0 ? 0 : 1 }}
                            >
                              <DeleteIcon sx={{ fontSize: "14px", color: "#e57373" }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </SortableContext>

              {/* ─── +行: 行追加 ─── */}
              <Box sx={{ display: "flex", alignItems: "center", mt: "4px" }}>
                {/* 行ハンドル列: 空 */}
                <Box sx={{ width: "32px", flexShrink: 0 }} />
                {/* セル列全体に広がる追加ボタン */}
                <Tooltip title={t("tableDialog.addRow")} placement="bottom">
                  <Box
                    onClick={handleAddRow}
                    sx={{
                      width: colCount * (colWidth + 2) - 2,
                      flexShrink: 0,
                      height: "28px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      border: "1px dashed var(--border-subtle)",
                      borderRadius: "2px",
                      color: "var(--text-faint)",
                      "&:hover": {
                        borderColor: "var(--text-secondary, var(--text-primary))",
                        color: "var(--text-secondary, var(--text-primary))",
                      },
                    }}
                  >
                    <AddIcon sx={{ fontSize: "14px" }} />
                  </Box>
                </Tooltip>
                <Box sx={{ width: addColWidth, flexShrink: 0, mr: "2px" }} />
                <Box sx={{ width: "32px", flexShrink: 0 }} />
              </Box>

              {/* ─── ×行: 列削除 ─── */}
              <Box sx={{ display: "flex", alignItems: "center", mt: "2px" }}>
                <Box sx={{ width: "32px", flexShrink: 0 }} />
                {aligns.map((_, c) => (
                  <Box key={c} sx={{ width: colWidth, flexShrink: 0, mr: "2px", boxSizing: "border-box", border: "1px solid transparent", display: "flex", justifyContent: "center" }}>
                    <Tooltip title={t("tableDialog.deleteColumn")} placement="bottom">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteColumn(c)}
                        disabled={aligns.length <= 1}
                        sx={{ padding: "2px", opacity: aligns.length <= 1 ? 0 : 1 }}
                      >
                        <DeleteIcon sx={{ fontSize: "14px", color: "#e57373" }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
                {/* +列・×列: ×行は空欄 */}
                <Box sx={{ width: addColWidth, flexShrink: 0, mr: "2px" }} />
                <Box sx={{ width: "32px", flexShrink: 0 }} />
              </Box>
            </Box>

          </DndContext>
        )}

        {/* ─── セル編集エリア ─── */}
        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "flex-start",
            borderTop: "1px solid var(--border-subtle)",
            pt: 1,
          }}
        >
          <TextField
            inputRef={cellInputRef}
            multiline
            rows={3}
            fullWidth
            label={
              selectedCell.r >= 0
                ? `${t("tableDialog.cellText")} (${selectedCell.r + 1}, ${selectedCell.c + 1})`
                : t("tableDialog.cellText")
            }
            value={cellText}
            onChange={(e) => handleCellTextChange(e.target.value)}
            disabled={selectedCell.r < 0}
            size="small"
            sx={{
              "& .MuiInputBase-root": {
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: "13px",
              },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--border-input)",
              },
              "& .MuiInputLabel-root": { color: "var(--text-muted)" },
              "& .MuiInputBase-input.Mui-disabled": {
                WebkitTextFillColor: "var(--text-faint)",
              },
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          borderTop: "1px solid var(--border-subtle)",
          px: 2,
          py: 1,
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <ActionButton variant="save" label={t("tableDialog.updateCell")} icon={<CheckIcon style={{ filter: 'drop-shadow(2px 2px 2px currentColor)' }} />} onClick={handleClose} />
      </DialogActions>

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.type === "row" ? t("tableDialog.deleteRowTitle") : t("tableDialog.deleteColumnTitle")}
        message={confirmState.type === "row" ? t("tableDialog.deleteRowConfirm") : t("tableDialog.deleteColumnConfirm")}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </ModalWrapper>
  );
}

export default TableDialog;
