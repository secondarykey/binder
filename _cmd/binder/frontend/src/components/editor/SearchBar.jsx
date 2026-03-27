import { useState, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { IconButton, TextField, InputAdornment } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import "../../i18n/config";
import { useTranslation } from 'react-i18next';

// 閉じても状態を保持するためコンポーネント外で管理
let savedPosition = { x: 60, y: 44 };
let savedQuery = "";

/**
 * エディタ内テキスト検索フローティングパネル
 *
 * Props:
 *   text       - 検索対象のテキスト全体
 *   onClose    - 検索バーを閉じるコールバック
 *   onNavigate - (absoluteStart, absoluteEnd) => void  一致箇所へ移動
 */
function SearchBar({ text, onClose, onNavigate }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(() => savedQuery);
  const [matches, setMatches] = useState([]);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  // ドラッグ状態
  const [position, setPosition] = useState(() => ({ ...savedPosition }));
  const dragRef = useRef(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // マウント時に入力欄にフォーカスし、前回のクエリがあれば再検索
  useEffect(() => {
    inputRef.current?.focus();
    if (savedQuery) {
      doSearchWith(savedQuery);
    }
  }, []);

  // ドラッグ処理
  const handleDragStart = useCallback((e) => {
    // テキスト選択を防止
    e.preventDefault();
    draggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }, [position]);

  const handleDragMove = useCallback((e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newPos = {
      x: dragStartRef.current.posX + dx,
      y: dragStartRef.current.posY + dy,
    };
    setPosition(newPos);
    savedPosition = newPos;
  }, []);

  const handleDragEnd = useCallback(() => {
    draggingRef.current = false;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  }, [handleDragMove]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  // 検索実行（引数指定で任意のクエリで検索可能）
  const doSearchWith = (searchText) => {
    if (!searchText) {
      setMatches([]);
      setSearched(false);
      return;
    }
    setSearched(true);
    const q = searchText.toLowerCase();
    const lines = text.split('\n');
    const results = [];
    let offset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      let pos = 0;
      while (true) {
        const idx = lineLower.indexOf(q, pos);
        if (idx === -1) break;
        results.push({
          line: i + 1,
          lineText: line,
          matchStart: idx,
          matchEnd: idx + searchText.length,
          absoluteStart: offset + idx,
          absoluteEnd: offset + idx + searchText.length,
        });
        pos = idx + 1;
      }
      offset += line.length + 1;
    }
    setMatches(results);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSearchWith(query);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleClickResult = (match) => {
    onNavigate(match.absoluteStart, match.absoluteEnd);
  };

  // 行テキストを表示（一致部分をハイライト）
  const renderLineText = (match) => {
    const { lineText, matchStart, matchEnd } = match;
    const contextChars = 40;
    const start = Math.max(0, matchStart - contextChars);
    const end = Math.min(lineText.length, matchEnd + contextChars);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < lineText.length ? "…" : "";

    const before = lineText.substring(start, matchStart);
    const matched = lineText.substring(matchStart, matchEnd);
    const after = lineText.substring(matchEnd, end);

    return <span>{prefix}{before}<mark>{matched}</mark>{after}{suffix}</span>;
  };

  return (
    <div
      className="editorSearchFloat"
      ref={dragRef}
      style={{ left: position.x + 'px', top: position.y + 'px' }}
    >
      {/** ドラッグハンドル + 検索入力行 */}
      <div className="editorSearchRow">
        <span
          className="editorSearchDragHandle"
          onMouseDown={handleDragStart}
        >
          <DragIndicatorIcon sx={{ fontSize: '16px' }} />
        </span>
        <TextField
          inputRef={inputRef}
          size="small"
          variant="outlined"
          placeholder={t("editor.searchPlaceholder")}
          value={query}
          onChange={(e) => { setQuery(e.target.value); savedQuery = e.target.value; }}
          onKeyDown={handleKeyDown}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '16px', color: 'var(--text-muted)' }} />
                </InputAdornment>
              ),
              sx: {
                height: '28px',
                fontSize: '0.82rem',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
              }
            }
          }}
          sx={{ flex: 1, minWidth: 160 }}
        />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {searched
            ? (matches.length > 0
              ? t("editor.searchMatches", { count: matches.length })
              : t("editor.searchNoMatches"))
            : ""}
        </span>
        <IconButton size="small" onClick={onClose} sx={{ color: 'var(--text-muted)' }}>
          <CloseIcon sx={{ fontSize: '16px' }} />
        </IconButton>
      </div>

      {matches.length > 0 && (
        <div className="editorSearchResults" ref={resultsRef}>
          {matches.map((match, idx) => (
            <div
              key={idx}
              className="editorSearchResultItem"
              onClick={() => handleClickResult(match)}
            >
              <span className="editorSearchLineNum">{match.line}</span>
              <span className="editorSearchLineText">{renderLineText(match)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

SearchBar.propTypes = {
  text: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onNavigate: PropTypes.func.isRequired,
};

export default SearchBar;
