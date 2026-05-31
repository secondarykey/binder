import { useState, useCallback, useRef } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import WrapTextIcon from '@mui/icons-material/WrapText';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import EditorArea from '@shared/editor/EditorArea';
import SearchBar from '@shared/editor/SearchBar';
import { handleMarkdownKeyDown } from '@shared/editor/markdown-keys';
import { useScrollbarOffset, useHScrollbarOffset } from './useHasScrollbar';

import './language';
import { useTranslation } from 'react-i18next';

/**
 * エディタペイン
 * EditorArea + SearchBar をラップし、Ctrl+F 検索を提供する
 */
function EditorPane({ text, onChange, wordWrap, onWordWrapToggle, showLineNumbers, onLineNumbersToggle }) {
  const { t } = useTranslation();
  const wrapBtnRight = useScrollbarOffset('#editor', 6, text);
  const wrapBtnBottom = useHScrollbarOffset('#editor', 6, text);
  const [showSearch, setShowSearch] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const composingRef = useRef(false);

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      const textarea = e.target;
      const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
      setSearchInitialQuery(selected || '');
      setShowSearch(true);
      return;
    }

    // Markdown入力支援（リスト継続・引用継続等）
    handleMarkdownKeyDown(e, composingRef, onChange);
  }, [onChange]);

  const handleChange = useCallback((e) => {
    onChange(e.target.value);
  }, [onChange]);

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
    document.querySelector('#editor')?.focus();
  }, []);

  const editorStyle = {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-editor)',
  };

  return (
    <Box id="editorContent" sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {showSearch && (
        <SearchBar
          text={text}
          onClose={handleSearchClose}
          onNavigate={handleSearchNavigate}
          initialQuery={searchInitialQuery}
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
