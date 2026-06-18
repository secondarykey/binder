import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import WrapTextIcon from '@mui/icons-material/WrapText';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import EditorArea from '@shared/editor/EditorArea';
import SearchBar from '@shared/editor/SearchBar';
import Autocomplete from '@shared/editor/Autocomplete';
import { handleMarkdownKeyDown } from '@shared/editor/markdown-keys';
import { useAutocomplete } from '@shared/editor/useAutocomplete';
import { useScrollbarOffset, useHScrollbarOffset } from './useHasScrollbar';
import { Events } from '@wailsio/runtime';

import './language';
import { useTranslation } from 'react-i18next';

/**
 * エディタペイン
 * EditorArea + SearchBar をラップし、Ctrl+F 検索を提供する
 */
function EditorPane({ text, onChange, wordWrap, onWordWrapToggle, showLineNumbers, onLineNumbersToggle, font, tabSize = 4, autocompleteTriggers = [] }) {
  const { t } = useTranslation();
  const wrapBtnRight = useScrollbarOffset('#editor', 6, text);
  const wrapBtnBottom = useHScrollbarOffset('#editor', 6, text);
  const [showSearch, setShowSearch] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [replaceMode, setReplaceMode] = useState(false);
  const composingRef = useRef(false);
  const hiddenFocusRef = useRef(null);

  const handleAutocompleteSelect = useCallback((trigger, selected, replaceStart, replaceEnd) => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(replaceStart, replaceEnd);
    document.execCommand('insertText', false, trigger + selected);
    requestAnimationFrame(() => {
      onChange(textarea.value);
    });
  }, [onChange]);

  const ac = useAutocomplete({
    triggers: autocompleteTriggers,
    textareaSelector: '#editor',
    composingRef,
    onSelect: handleAutocompleteSelect,
  });

  // ウィンドウフォーカス時の IME リセット
  // 同一要素の blur/focus では TSF コンテキストがリセットされないため、
  // 一度 hidden input に移してから textarea に戻す
  useEffect(() => {
    const cancel = Events.On('lite:window:focus', () => {
      if (composingRef.current) return;
      const textarea = document.querySelector('#editor');
      if (!textarea || !hiddenFocusRef.current) return;
      const active = document.activeElement;
      if (active && active !== textarea && active !== document.body && active !== hiddenFocusRef.current) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      hiddenFocusRef.current.focus();
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start, end);
      });
    });
    return () => cancel();
  }, []);

  // Ctrl+F / Ctrl+H でSearchBarを開閉（document レベルで処理）
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const textarea = document.querySelector('#editor');
        if (textarea) {
          const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
          if (selected) setSearchInitialQuery(selected);
        }
        setShowSearch(prev => {
          if (!prev) { setReplaceMode(false); return true; }
          if (replaceMode) { setReplaceMode(false); return true; }
          return false;
        });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        const textarea = document.querySelector('#editor');
        if (textarea) {
          const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
          if (selected) setSearchInitialQuery(selected);
        }
        setShowSearch(prev => {
          if (!prev) { setReplaceMode(true); return true; }
          if (!replaceMode) { setReplaceMode(true); return true; }
          return false;
        });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [replaceMode]);

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'h')) return;

    if (ac.handleKeyDown(e)) return;

    // Markdown入力支援（リスト継続・引用継続・Tab/Shift+Tab等）
    handleMarkdownKeyDown(e, composingRef, onChange, tabSize);
  }, [onChange, tabSize, ac]);

  const handleChange = useCallback((e) => {
    onChange(e.target.value);
    ac.handleInput();
  }, [onChange, ac]);

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    composingRef.current = true;
    requestAnimationFrame(() => {
      composingRef.current = false;
    });
  }, []);

  const handleSearchNavigate = useCallback((start, end) => {
    const textarea = document.querySelector('#editor');
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(start, end);
    }
  }, []);

  const handleSearchClose = useCallback(() => {
    setShowSearch(false);
    setReplaceMode(false);
    document.querySelector('#editor')?.focus();
  }, []);

  const handleReplace = useCallback((absoluteStart, absoluteEnd, replacement) => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(absoluteStart, absoluteEnd);
    document.execCommand('insertText', false, replacement);
    requestAnimationFrame(() => {
      onChange(textarea.value);
    });
  }, [onChange]);

  const handleReplaceAll = useCallback((matches, replacement) => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return;
    textarea.focus();
    let newText = text;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      newText = newText.substring(0, m.absoluteStart) + replacement + newText.substring(m.absoluteEnd);
    }
    textarea.select();
    document.execCommand('insertText', false, newText);
    requestAnimationFrame(() => {
      onChange(textarea.value);
    });
  }, [text, onChange]);

  const editorStyle = {
    fontFamily: font?.name || 'monospace',
    fontSize: (font?.size || 14) + 'px',
    color: font?.color || 'var(--text-primary)',
    backgroundColor: font?.backgroundColor || 'var(--bg-editor)',
  };

  return (
    <Box id="editorContent" sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* IME リセット用 hidden input */}
      <input
        ref={hiddenFocusRef}
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
        readOnly
      />
      <Autocomplete
        isOpen={ac.isOpen}
        items={ac.items}
        selectedIndex={ac.selectedIndex}
        position={ac.position}
        onItemClick={(idx) => ac.selectItem(idx)}
      />
      {showSearch && (
        <SearchBar
          text={text}
          onClose={handleSearchClose}
          onNavigate={handleSearchNavigate}
          initialQuery={searchInitialQuery}
          replaceMode={replaceMode}
          onReplace={handleReplace}
          onReplaceAll={handleReplaceAll}
        />
      )}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <EditorArea
          text={text}
          style={editorStyle}
          showLineNumbers={showLineNumbers}
          wordWrap={wordWrap}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
        />
      </Box>

      {/* 行番号トグル（左上） */}
      <Tooltip title={t(showLineNumbers ? 'lite.lineNumbersOn' : 'lite.lineNumbersOff')} placement="right">
        <IconButton
          size="small"
          onClick={onLineNumbersToggle}
          sx={{
            position: 'absolute',
            top: 6,
            left: 6,
            zIndex: 10,
            color: showLineNumbers ? 'var(--text-primary)' : 'var(--text-muted)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: '4px',
            width: 28,
            height: 28,
            opacity: 0.4,
            '&:hover': { opacity: 1, backgroundColor: 'var(--bg-overlay)' },
          }}
        >
          <FormatListNumberedIcon sx={{ fontSize: '16px' }} />
        </IconButton>
      </Tooltip>

      {/* 折り返しトグル（右下） */}
      <Tooltip title={t(wordWrap ? 'lite.wordWrapOn' : 'lite.wordWrapOff')} placement="top">
        <IconButton
          size="small"
          onClick={onWordWrapToggle}
          sx={{
            position: 'absolute',
            bottom: wrapBtnBottom,
            right: wrapBtnRight,
            zIndex: 10,
            color: wordWrap ? 'var(--text-primary)' : 'var(--text-muted)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: '4px',
            width: 28,
            height: 28,
            opacity: 0.4,
            '&:hover': { opacity: 1, backgroundColor: 'var(--bg-overlay)' },
          }}
        >
          <WrapTextIcon sx={{ fontSize: '16px' }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default EditorPane;
