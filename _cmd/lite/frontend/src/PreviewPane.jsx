import { useState, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import HTMLFrame from './components/editor/HTMLFrame';
import Marked from './components/editor/engines/Marked';

/**
 * プレビューペイン
 * Markdown テキストを marked.js で HTML に変換し、HTMLFrame で表示する。
 * 固定テンプレートでラップする。
 */
function PreviewPane({ text }) {
  const [html, setHtml] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    // デバウンス（300ms）でパース
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const parsed = await Marked.parseWithSourceLines(text || '');
        const themeId = document.documentElement.dataset.theme || 'dark';
        const wrapped = wrapHTML(parsed, themeId);
        setHtml(wrapped);
      } catch (err) {
        console.error('Parse error:', err);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text]);

  return (
    <Box sx={{ height: '100%', overflow: 'hidden' }}>
      <HTMLFrame html={html} />
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
  .binderSVG { margin: 1em 0; }
</style>
</head>
<body>${bodyHTML}</body>
</html>`;
}

export default PreviewPane;
