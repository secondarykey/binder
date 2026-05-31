import { useState, useEffect, useRef } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HTMLFrame from '@shared/editor/HTMLFrame';
import Marked from '@shared/editor/engines/Marked';
import Mermaid from '@shared/editor/engines/Mermaid';
import { useIframeScrollbarOffset } from './useHasScrollbar';

/**
 * プレビューペイン
 * mermaidMode に応じて Markdown または Mermaid でプレビューする。
 * 切り替えは親（App）がタブごとに管理する。
 */
function PreviewPane({ text, mermaidMode, onToggleMode }) {
  const [html, setHtml] = useState('');
  const [currentTheme, setCurrentTheme] = useState(document.documentElement.dataset.theme || 'dark');
  const timerRef = useRef(null);

  // iframe のスクロールバー検出（切り替えボタンの位置調整用）
  const toggleBtnRight = useIframeScrollbarOffset('iframe.htmlViewer', 6, html);

  // data-theme 属性の変更を監視してプレビューを再描画
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.dataset.theme || 'dark';
      setCurrentTheme(theme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        if (mermaidMode) {
          const data = await Mermaid.parse(text || '');
          const wrapped = wrapHTML(`<div class="binderSVG">${data.svg}</div>`, currentTheme);
          setHtml(wrapped);
        } else {
          const parsed = await Marked.parseWithSourceLines(text || '');
          const wrapped = wrapHTML(parsed, currentTheme);
          setHtml(wrapped);
        }
      } catch (err) {
        console.error('Parse error:', err);
        if (mermaidMode) {
          const errMsg = String(err.message || err).replace(/</g, '&lt;');
          const wrapped = wrapHTML(`<pre style="color:#e57373;white-space:pre-wrap">${errMsg}</pre>`, currentTheme);
          setHtml(wrapped);
        }
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, mermaidMode, currentTheme]);

  return (
    <Box sx={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
      <HTMLFrame html={html} />

      {/* 切り替えボタン（右上に重ねて配置） */}
      <Tooltip title={mermaidMode ? 'Markdown' : 'Mermaid'} placement="left">
        <IconButton
          size="small"
          onClick={onToggleMode}
          sx={{
            position: 'absolute',
            top: 6,
            right: toggleBtnRight,
            zIndex: 10,
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: '4px',
            width: 28,
            height: 28,
            opacity: 0.4,
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
