import { useState, useEffect } from "react";
import {
  Box, Button, DialogActions, DialogContent, IconButton,
  TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from "@mui/material";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove,
  verticalListSortingStrategy, horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import ModalWrapper from "./components/ModalWrapper.jsx";
import "../i18n/config";
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
        width: colWidth,
        flexShrink: 0,
      }}
      sx={{
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

function SortableRow({
  id, row, r, aligns, selectedCell, onCellClick, onDeleteRow, colWidth,
}) {
  const { t } = useTranslation();
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{
        display: "flex",
        alignItems: "stretch",
        opacity: isDragging ? 0.4 : 1,
        mb: "2px",
      }}
    >
      {/* 行ドラッグハンドル */}
      <Box
        sx={{
          width: "32px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          color: "var(--text-faint)",
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
              aligns[c] === "center"
                ? "center"
                : aligns[c] === "right"
                ? "right"
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
            <span
              style={{
                color: "var(--text-faint)",
                fontStyle: "italic",
                pointerEvents: "none",
              }}
            >
              &nbsp;
            </span>
          )}
        </Box>
      ))}

      {/* 行削除ボタン */}
      <Box sx={{ width: "32px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Tooltip title={t("tableDialog.deleteRow")} placement="right">
          <span>
            <IconButton
              size="small"
              onClick={() => onDeleteRow(r)}
              disabled={r === 0}
              sx={{
                color: r === 0 ? "transparent" : "var(--accent-red, #e57373)",
                padding: "2px",
              }}
            >
              <DeleteIcon sx={{ fontSize: "14px" }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
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
  const [activeId, setActiveId] = useState(null);

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
  const colWidth = 70;

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
    setAligns((a) => a.filter((_, i) => i !== c));
    setRows((prev) => prev.map((row) => row.filter((_, i) => i !== c)));
    if (selectedCell.c === c) setSelectedCell({ r: -1, c: -1 });
    else if (selectedCell.c > c)
      setSelectedCell((sel) => ({ ...sel, c: sel.c - 1 }));
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, Array(colCount).fill("")]);
  };

  const handleDeleteRow = (r) => {
    if (r === 0) return;
    if (rows.length <= 2) return; // ヘッダ + 最低1データ行
    setRows((prev) => prev.filter((_, i) => i !== r));
    if (selectedCell.r === r) setSelectedCell({ r: -1, c: -1 });
    else if (selectedCell.r > r)
      setSelectedCell((sel) => ({ ...sel, r: sel.r - 1 }));
  };

  const handleAlignChange = (c, value) => {
    setAligns((prev) => prev.map((a, i) => (i === c ? value : a)));
  };

  // ────────────────────────
  // ドラッグ
  // ────────────────────────

  const handleDragStart = ({ active }) => setActiveId(String(active.id));

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
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
      width="1000px"
      height="80vh"
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
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <Box sx={{ overflowX: "auto", pb: 1 }}>
              {/* ─── 列ドラッグハンドル行 ─── */}
              <Box sx={{ display: "flex", alignItems: "center", mb: "2px" }}>
                {/* 行ドラッグハンドル列の空欄 */}
                <Box sx={{ width: "32px", flexShrink: 0 }} />

                <SortableContext items={colIds} strategy={horizontalListSortingStrategy}>
                  {colIds.map((cid) => (
                    <Box key={cid} sx={{ mr: "2px" }}>
                      <SortableColHandle id={cid} colWidth={colWidth} />
                    </Box>
                  ))}
                </SortableContext>

                {/* 列追加ボタン */}
                <Tooltip title={t("tableDialog.addColumn")} placement="top">
                  <IconButton
                    size="small"
                    onClick={handleAddColumn}
                    sx={{
                      width: "32px",
                      flexShrink: 0,
                      color: "var(--text-secondary, var(--text-primary))",
                    }}
                  >
                    <AddIcon sx={{ fontSize: "14px" }} />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* ─── Align 設定行 ─── */}
              <Box sx={{ display: "flex", alignItems: "center", mb: "4px" }}>
                <Box sx={{ width: "32px", flexShrink: 0 }} />

                {aligns.map((align, c) => (
                  <Box key={c} sx={{ width: colWidth, flexShrink: 0, mr: "2px", boxSizing: "border-box" }}>
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

                {/* 削除ボタン列の空欄 */}
                <Box sx={{ width: "32px", flexShrink: 0 }} />
              </Box>

              {/* ─── データ行 ─── */}
              <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
                {rows.map((row, r) => (
                  <SortableRow
                    key={rowIds[r]}
                    id={rowIds[r]}
                    row={row}
                    r={r}
                    aligns={aligns}
                    selectedCell={selectedCell}
                    onCellClick={handleCellClick}
                    onDeleteRow={handleDeleteRow}
                    colWidth={colWidth}
                  />
                ))}
              </SortableContext>

              {/* ─── フッタ行（行追加 + 列削除） ─── */}
              <Box sx={{ display: "flex", alignItems: "center", mt: "4px" }}>
                {/* 行追加ボタン */}
                <Tooltip title={t("tableDialog.addRow")} placement="bottom">
                  <IconButton
                    size="small"
                    onClick={handleAddRow}
                    sx={{
                      width: "32px",
                      flexShrink: 0,
                      color: "var(--text-secondary, var(--text-primary))",
                    }}
                  >
                    <AddIcon sx={{ fontSize: "14px" }} />
                  </IconButton>
                </Tooltip>

                {/* 列削除ボタン群 */}
                {aligns.map((_, c) => (
                  <Box
                    key={c}
                    sx={{
                      width: colWidth,
                      flexShrink: 0,
                      mr: "2px",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <Tooltip title={t("tableDialog.deleteColumn")} placement="bottom">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteColumn(c)}
                        disabled={aligns.length <= 1}
                        sx={{
                          color:
                            aligns.length <= 1
                              ? "transparent"
                              : "var(--accent-red, #e57373)",
                          padding: "2px",
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: "14px" }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}

                {/* 削除ボタン列の空欄 */}
                <Box sx={{ width: "32px", flexShrink: 0 }} />
              </Box>
            </Box>

            <DragOverlay>
              {activeId && activeId.startsWith("row-") && (() => {
                const idx = parseInt(activeId.slice(4));
                return (
                  <Box
                    sx={{
                      display: "flex",
                      backgroundColor: "var(--bg-elevated)",
                      opacity: 0.85,
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "2px",
                      p: "2px 4px",
                    }}
                  >
                    <Typography sx={{ fontSize: "13px", color: "var(--text-primary)" }}>
                      {rows[idx]?.join(" | ")}
                    </Typography>
                  </Box>
                );
              })()}
            </DragOverlay>
          </DndContext>
        )}

        {/* ─── セル編集エリア ─── */}
        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "flex-start",
            borderTop: "1px solid var(--border-subtle)",
            pt: 1.5,
          }}
        >
          <TextField
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
        <Button variant="contained" onClick={handleClose}>
          {t("tableDialog.updateCell")}
        </Button>
      </DialogActions>
    </ModalWrapper>
  );
}

export default TableDialog;
