import { useState, useRef, useEffect, forwardRef } from "react";
import PropTypes from "prop-types";
import { IconButton, TextField, InputAdornment } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import "../../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * エディタ内テキスト検索バー
 *
 * Props:
 *   text       - 検索対象のテキスト全体
 *   onClose    - 検索バーを閉じるコールバック
 *   onNavigate - (absoluteStart, absoluteEnd) => void  一致箇所へ移動
 */
const SearchBar = forwardRef(function SearchBar({ text, onClose, onNavigate }, ref) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  // マウント時に入力欄にフォーカス
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 検索実行
  const doSearch = () => {
    if (!query) {
      setMatches([]);
      setSearched(false);
      return;
    }
    setSearched(true);
    const q = query.toLowerCase();
    const lines = text.split('\n');
    const results = [];
    let offset = 0; // 各行の開始位置（テキスト全体での絶対位置）

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
          matchEnd: idx + query.length,
          absoluteStart: offset + idx,
          absoluteEnd: offset + idx + query.length,
        });
        pos = idx + 1;
      }
      offset += line.length + 1; // +1 for '\n'
    }
    setMatches(results);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSearch();
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
    // 長い行は一致箇所周辺だけ表示
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
    <div className="editorSearchBar" ref={ref}>
      <div className="editorSearchRow">
        <TextField
          inputRef={inputRef}
          size="small"
          variant="outlined"
          placeholder={t("editor.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
          sx={{ flex: 1, maxWidth: 300 }}
        />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {searched
            ? (matches.length > 0
              ? t("editor.searchMatches", { count: matches.length })
              : t("editor.searchNoMatches"))
            : ""}
        </span>
        <IconButton size="small" onClick={onClose} sx={{ color: 'var(--text-muted)', ml: 'auto' }}>
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
});

SearchBar.propTypes = {
  text: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onNavigate: PropTypes.func.isRequired,
};

export default SearchBar;
