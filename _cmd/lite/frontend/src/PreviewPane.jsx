import { useState, useEffect, useRef } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HTMLFrame from '@shared/editor/HTMLFrame';
import Marked from '@shared/editor/engines/Marked';
import Mermaid from '@shared/editor/engines/Mermaid';
import { GetPreviewHTML } from '../bindings/binder/api/lite/app';
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
        let bodyHTML;
        if (mermaidMode) {
          const data = await Mermaid.parse(text || '');
          bodyHTML = `<div class="binderSVG">${data.svg}</div>`;
        } else {
          bodyHTML = await Marked.parseWithSourceLines(text || '');
        }
        const wrapped = await GetPreviewHTML(currentTheme, bodyHTML);
        setHtml(wrapped);
      } catch (err) {
        console.error('Parse error:', err);
        if (mermaidMode) {
          const errMsg = String(err.message || err).replace(/</g, '&lt;');
          try {
            const wrapped = await GetPreviewHTML(currentTheme, `<pre style="color:#e57373;white-space:pre-wrap">${errMsg}</pre>`);
            setHtml(wrapped);
          } catch {
            // フォールバック: テンプレート読み込みも失敗した場合
          }
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

export default PreviewPane;
