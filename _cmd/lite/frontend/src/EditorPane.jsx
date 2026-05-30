import { useState, useCallback } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import WrapTextIcon from '@mui/icons-material/WrapText';
import EditorArea from './components/editor/EditorArea';
import SearchBar from './components/editor/SearchBar';

import './language';
import { useTranslation } from 'react-i18next';

/**
 * エディタペイン
 * EditorArea + SearchBar をラップし、Ctrl+F 検索を提供する
 */
function EditorPane({ text, onChange, wordWrap, onWordWrapToggle }) {
  const { t } = useTranslation();
  const [showSearch, setShowSearch] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      // 選択テキストがあれば初期クエリにする
      const textarea = e.target;
      const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
      setSearchInitialQuery(selected || '');
      setShowSearch(true);
    }
  }, []);

  const handleChange = useCallback((e) => {
    onChange(e.target.value);
  }, [onChange]);

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
          showLineNumbers={true}
          wordWrap={wordWrap}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
        />
      </Box>

      {/* 折り返しトグル（右下） */}
      <Tooltip title={t(wordWrap ? 'lite.wordWrapOn' : 'lite.wordWrapOff')} placement="top">
        <IconButton
          size="small"
          onClick={onWordWrapToggle}
          sx={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            zIndex: 10,
            color: wordWrap ? 'var(--text-primary)' : 'var(--text-muted)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: '4px',
            width: 28,
            height: 28,
            opacity: 0.7,
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
