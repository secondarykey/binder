import { useState, useRef, useEffect, useCallback } from "react";
import { IconButton, TextField, InputAdornment } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import FindReplaceIcon from '@mui/icons-material/FindReplace';
import { useTranslation } from 'react-i18next';

// 閉じても状態を保持するためコンポーネント外で管理
let savedPosition = null; // null = 未初期化（初回は中央に配置）
let savedQuery = "";
let savedReplaceText = "";

/**
 * エディタ内テキスト検索・置換フローティングパネル
 *
 * Props:
 *   text           - 検索対象のテキスト全体
 *   onClose        - 検索バーを閉じるコールバック
 *   onNavigate     - (absoluteStart, absoluteEnd) => void  一致箇所へ移動
 *   onClearHighlight - ハイライト解除コールバック
 *   initialQuery   - 初期検索クエリ
 *   replaceMode    - 置換モードで開くかどうか
 *   onReplace      - (absoluteStart, absoluteEnd, replacement) => void  単一置換
 *   onReplaceAll   - (matches, replacement) => void  全置換
 */
function SearchBar({ text, onClose, onNavigate, onClearHighlight, initialQuery, replaceMode: initialReplaceMode, onReplace, onReplaceAll }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(() => initialQuery || savedQuery);
  const [matches, setMatches] = useState([]);
  const [searched, setSearched] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showReplace, setShowReplace] = useState(initialReplaceMode || false);
  const [replaceText, setReplaceText] = useState(savedReplaceText);
  const inputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const resultsRef = useRef(null);
  const itemRefs = useRef([]);

  // ドラッグ状態
  const panelRef = useRef(null);
  const [position, setPosition] = useState(() => savedPosition ? { ...savedPosition } : { x: 0, y: 0 });
  const [visible, setVisible] = useState(!!savedPosition);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // マウント時に初期検索・初期位置を算出
  useEffect(() => {
    const q = initialQuery || savedQuery;
    if (q) {
      savedQuery = q;
      doSearchWith(q);
    }
    // 初回のみ #editorContent の中央に配置
    if (!savedPosition && panelRef.current) {
      const content = document.querySelector('#editorContent');
      if (content) {
        const contentRect = content.getBoundingClientRect();
        const panelRect = panelRef.current.getBoundingClientRect();
        const wrapperRect = panelRef.current.offsetParent?.getBoundingClientRect() || contentRect;
        const centerX = (contentRect.left + contentRect.width / 2) - wrapperRect.left - panelRect.width / 2;
        const pos = { x: Math.max(0, centerX), y: 44 };
        setPosition(pos);
        savedPosition = pos;
      }
      setVisible(true);
    }
  }, []);

  // パネルが可視になってから入力欄へフォーカスする。
  // 起動後1回目は savedPosition が無く visible=false（visibility:hidden）でマウントされ、
  // visibility:hidden の要素は focus できないため、マウント時に focus すると無視される。
  // visible が確定（true）してから focus することで初回もフォーカスが当たるようにする。
  useEffect(() => {
    if (!visible) return;
    if (showReplace) {
      replaceInputRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [visible]);

  // 置換モードが開かれたら置換入力にフォーカス
  useEffect(() => {
    if (showReplace && replaceInputRef.current) {
      replaceInputRef.current.focus();
    }
  }, [showReplace]);

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
      x: Math.max(0, dragStartRef.current.posX + dx),
      y: Math.max(0, dragStartRef.current.posY + dy),
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

  // テキスト（ファイル内容）が更新されたら現在のクエリで再検索。
  // 毎キーストロークの全文スキャンを避けるためデバウンスし、
  // カーソルを奪わない refreshMatches で一致リストだけ更新する
  useEffect(() => {
    if (!(query && searched)) return;
    const timer = setTimeout(() => refreshMatches(query), 300);
    return () => clearTimeout(timer);
  }, [text]);

  // 全文スキャンして一致リストを返す
  const scanMatches = (searchText) => {
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
    return results;
  };

  // 検索実行（引数指定で任意のクエリで検索可能）。ユーザー操作起点で先頭一致へ移動する
  const doSearchWith = (searchText) => {
    if (!searchText) {
      setMatches([]);
      setSearched(false);
      return;
    }
    setSearched(true);
    const results = scanMatches(searchText);
    setMatches(results);
    if (results.length > 0) {
      setCurrentIndex(0);
      onNavigate(results[0].absoluteStart, results[0].absoluteEnd);
    } else {
      setCurrentIndex(-1);
      onClearHighlight?.();
    }
  };

  // 本文変更起点の再検索。一致リストのみ更新し、カーソルは移動しない
  const refreshMatches = (searchText) => {
    const results = scanMatches(searchText);
    setMatches(results);
    if (results.length > 0) {
      setCurrentIndex((prev) => Math.max(0, Math.min(prev, results.length - 1)));
    } else {
      setCurrentIndex(-1);
      onClearHighlight?.();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searched && matches.length > 0) {
        const next = e.shiftKey
          ? (currentIndex - 1 + matches.length) % matches.length
          : (currentIndex + 1) % matches.length;
        setCurrentIndex(next);
        onNavigate(matches[next].absoluteStart, matches[next].absoluteEnd);
      } else {
        doSearchWith(query);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleReplaceKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleReplaceCurrent();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleReplaceCurrent = () => {
    if (!onReplace || currentIndex < 0 || currentIndex >= matches.length) return;
    const match = matches[currentIndex];
    onReplace(match.absoluteStart, match.absoluteEnd, replaceText);
  };

  const handleReplaceAll = () => {
    if (!onReplaceAll || matches.length === 0) return;
    onReplaceAll(matches, replaceText);
  };

  const handleClickResult = (match, idx) => {
    setCurrentIndex(idx);
    onNavigate(match.absoluteStart, match.absoluteEnd);
  };

  // アクティブアイテムを結果リスト内でスクロール表示
  useEffect(() => {
    if (currentIndex >= 0 && itemRefs.current[currentIndex]) {
      itemRefs.current[currentIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [currentIndex]);

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
      ref={panelRef}
      style={{ left: position.x + 'px', top: position.y + 'px', visibility: visible ? 'visible' : 'hidden' }}
    >
      {/** ドラッグハンドル + 入力エリア + 右端ボタン群 */}
      <div className="editorSearchRow">
        {/** 左: ドラッグハンドル */}
        <span
          className="editorSearchDragHandle"
          onMouseDown={handleDragStart}
        >
          <DragIndicatorIcon sx={{ fontSize: '16px' }} />
        </span>

        {/** 中央: 検索・置換入力欄（縦並び） */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <TextField
            inputRef={inputRef}
            size="small"
            variant="outlined"
            placeholder={t("editor.searchPlaceholder")}
            value={query}
            onChange={(e) => { setQuery(e.target.value); savedQuery = e.target.value; setSearched(false); }}
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
            sx={{ width: '100%' }}
          />
          {showReplace && (
            <TextField
              inputRef={replaceInputRef}
              size="small"
              variant="outlined"
              placeholder={t("editor.replacePlaceholder")}
              value={replaceText}
              onChange={(e) => { setReplaceText(e.target.value); savedReplaceText = e.target.value; }}
              onKeyDown={handleReplaceKeyDown}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <FindReplaceIcon sx={{ fontSize: '16px', color: 'var(--text-muted)' }} />
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
              sx={{ width: '100%' }}
            />
          )}
        </div>

        {/** 右: ボタン群（縦並び・固定幅） */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0, alignItems: 'flex-end' }}>
          {/** 検索行の右側: カウント + 置換トグル + 閉じる */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '28px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', minWidth: '48px', textAlign: 'right' }}>
              {searched
                ? (matches.length > 0
                  ? `${currentIndex + 1} / ${matches.length}`
                  : t("editor.searchNoMatches"))
                : ""}
            </span>
            {onReplace && (
              <IconButton
                size="small"
                onClick={() => setShowReplace(!showReplace)}
                sx={{ color: showReplace ? 'var(--text-primary)' : 'var(--text-muted)', padding: '4px' }}
                title={t("editor.replaceToggle")}
              >
                <FindReplaceIcon sx={{ fontSize: '16px' }} />
              </IconButton>
            )}
            <IconButton size="small" onClick={onClose} sx={{ color: 'var(--text-muted)', padding: '4px' }}>
              <CloseIcon sx={{ fontSize: '16px' }} />
            </IconButton>
          </div>
          {/** 置換行の右側: 置換 + 全置換 */}
          {showReplace && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '28px' }}>
              <button
                className="editorSearchReplaceBtn"
                onClick={handleReplaceCurrent}
                disabled={currentIndex < 0}
                title={t("editor.replaceOne")}
              >
                {t("editor.replaceOne")}
              </button>
              <button
                className="editorSearchReplaceBtn"
                onClick={handleReplaceAll}
                disabled={matches.length === 0}
                title={t("editor.replaceAll")}
              >
                {t("editor.replaceAll")}
              </button>
            </div>
          )}
        </div>
      </div>

      {matches.length > 0 && (
        <div className="editorSearchResults" ref={resultsRef}>
          {matches.map((match, idx) => (
            <div
              key={idx}
              ref={el => itemRefs.current[idx] = el}
              className={`editorSearchResultItem${idx === currentIndex ? ' active' : ''}`}
              onClick={() => handleClickResult(match, idx)}
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

export default SearchBar;
