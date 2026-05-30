import { useState, useEffect, useRef } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HTMLFrame from './components/editor/HTMLFrame';
import Marked from './components/editor/engines/Marked';
import Mermaid from './components/editor/engines/Mermaid';

import './language';
import { useTranslation } from 'react-i18next';

const MERMAID_EXTENSIONS = ['.mmd', '.mermaid'];

/**
 * ファイル名からMermaidファイルかどうかを判定する
 */
function isMermaidFile(filename) {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return MERMAID_EXTENSIONS.some(ext => lower.endsWith(ext));
}

/**
 * プレビューペイン
 * ファイル種別に応じて Markdown または Mermaid でプレビューする。
 * 右上の切り替えボタンで手動切替も可能。
 */
function PreviewPane({ text, filename }) {
  const { t } = useTranslation();
  const [html, setHtml] = useState('');
  const [mermaidMode, setMermaidMode] = useState(false);
  const timerRef = useRef(null);
  const prevFilenameRef = useRef(filename);

  // ファイルが切り替わったら拡張子に基づいてモードをリセット
  useEffect(() => {
    if (filename !== prevFilenameRef.current) {
      setMermaidMode(isMermaidFile(filename));
      prevFilenameRef.current = filename;
    }
  }, [filename]);

  // 初回マウント時にも拡張子判定
  useEffect(() => {
    setMermaidMode(isMermaidFile(filename));
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const themeId = document.documentElement.dataset.theme || 'dark';
        if (mermaidMode) {
          const data = await Mermaid.parse(text || '');
          const wrapped = wrapHTML(`<div class="binderSVG">${data.svg}</div>`, themeId);
          setHtml(wrapped);
        } else {
          const parsed = await Marked.parseWithSourceLines(text || '');
          const wrapped = wrapHTML(parsed, themeId);
          setHtml(wrapped);
        }
      } catch (err) {
        console.error('Parse error:', err);
        if (mermaidMode) {
          const themeId = document.documentElement.dataset.theme || 'dark';
          const errMsg = String(err.message || err).replace(/</g, '&lt;');
          const wrapped = wrapHTML(`<pre style="color:#e57373;white-space:pre-wrap">${errMsg}</pre>`, themeId);
          setHtml(wrapped);
        }
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, mermaidMode]);

  return (
    <Box sx={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
      <HTMLFrame html={html} />

      {/* 切り替えボタン（右上に重ねて配置） */}
      <Tooltip title={mermaidMode ? 'Markdown' : 'Mermaid'} placement="left">
        <IconButton
          size="small"
          onClick={() => setMermaidMode(prev => !prev)}
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            zIndex: 10,
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: '4px',
            width: 28,
            height: 28,
            opacity: 0.7,
            '&:hover': { opacity: 1, backgroundColor: 'var(--bg-overlay)' },
          }}
        >
          {mermaidMode
            ? <DescriptionIcon sx={{ fontSize: '16px' }} />
            : <AccountTreeIcon sx={{ fontSize: '16px' }} />
          }
        </IconButton>
      </Tooltip>
    </Box>
  );
}

/**
 * 固定テンプレートで HTML をラップする
 */
function wrapHTML(bodyHTML, themeId) {
  const isDark = themeId === 'dark';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 15px;
    line-height: 1.7;
    color: ${isDark ? '#e0e0e0' : '#333'};
    background-color: ${isDark ? '#1e1e1e' : '#fff'};
    padding: 24px 32px;
    margin: 0;
    word-wrap: break-word;
  }
  h1, h2, h3, h4, h5, h6 {
    margin-top: 1.2em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.3;
  }
  h1 { font-size: 1.8em; border-bottom: 1px solid ${isDark ? '#444' : '#ddd'}; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid ${isDark ? '#444' : '#ddd'}; padding-bottom: 0.2em; }
  h3 { font-size: 1.25em; }
  code {
    background-color: ${isDark ? '#2d2d2d' : '#f5f5f5'};
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.9em;
  }
  pre {
    background-color: ${isDark ? '#2d2d2d' : '#f5f5f5'};
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
  }
  pre code {
    background: none;
    padding: 0;
  }
  blockquote {
    border-left: 4px solid ${isDark ? '#555' : '#ddd'};
    margin: 1em 0;
    padding: 0.5em 1em;
    color: ${isDark ? '#aaa' : '#666'};
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
  }
  th, td {
    border: 1px solid ${isDark ? '#555' : '#ddd'};
    padding: 8px 12px;
    text-align: left;
  }
  th {
    background-color: ${isDark ? '#2d2d2d' : '#f5f5f5'};
    font-weight: 600;
  }
  a { color: ${isDark ? '#6cb6ff' : '#0366d6'}; text-decoration: none; }
  a:hover { text-decoration: underline; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid ${isDark ? '#444' : '#ddd'}; margin: 2em 0; }
  ul, ol { padding-left: 2em; }
  li { margin: 0.3em 0; }
  .binderSVG { margin: 1em 0; text-align: center; }
</style>
</head>
<body>${bodyHTML}</body>
</html>`;
}

export default PreviewPane;
