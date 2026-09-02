import { useState, useEffect, useRef, useMemo } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { useTranslation } from 'react-i18next';
import { Browser } from '@wailsio/runtime';
import HTMLFrame from '@shared/editor/HTMLFrame';
import Marked from '@shared/editor/engines/Marked';
import Mermaid from '@shared/editor/engines/Mermaid';
import { GetPreviewHTML } from '../bindings/binder/api/lite/app';
import { CopyToClipboard } from '../bindings/main/window';
import { useIframeScrollbarOffset } from './useHasScrollbar';

/** HTML 属性値に埋め込むためのエスケープ */
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * プレビューペイン
 * mermaidMode に応じて Markdown または Mermaid でプレビューする。
 * 切り替えは親（App）がタブごとに管理する。
 */
function PreviewPane({ text, mermaidMode, onToggleMode, cursorLine }) {
  const { t, i18n } = useTranslation();
  const [html, setHtml] = useState('');
  const [currentTheme, setCurrentTheme] = useState(document.documentElement.dataset.theme || 'dark');
  const timerRef = useRef(null);

  // コードブロックのコピーボタン用ラベル。
  // 参照が変わると HTMLFrame がラベルを差し替えるため、言語が変わった時だけ作り直す
  const copyLabels = useMemo(() => ({
    copy: t('lite.copyCode'),
    copied: t('lite.copiedCode'),
  }), [t, i18n.language]);

  // 図の拡大・移動操作の説明（title 属性）。ホイールの扱いがモードで違う
  const panZoomHint = t('lite.panZoomHint');
  const inlinePanZoomHint = t('lite.inlinePanZoomHint');

  // 図の操作ボタンのラベル（渡すとボタンが表示される）
  const panZoomLabels = useMemo(() => ({
    zoomIn: t('lite.zoomIn'),
    zoomOut: t('lite.zoomOut'),
    reset: t('lite.resetView'),
  }), [t, i18n.language]);

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
          // data-copy-text を持たせると HTMLFrame がコピーボタンを付ける
          bodyHTML = `<div class="binderSVG" data-copy-text="${escapeAttr(text || '')}">${data.svg}</div>`;
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

  // プレビュー内の外部リンクは OS のブラウザで開く。
  // Lite にはバインダーが無いため、内部リンク（相対パス）は何も起こさない
  const handleLinkExternal = (url) => {
    Browser.OpenURL(url).catch(() => {});
  };

  return (
    <Box sx={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
      <HTMLFrame
        html={html}
        onLinkExternal={handleLinkExternal}
        onCopyCode={CopyToClipboard}
        copyLabels={copyLabels}
        inlineMermaid={!mermaidMode}
        cursorLine={mermaidMode ? null : cursorLine}
        panZoomHint={panZoomHint}
        inlinePanZoomHint={inlinePanZoomHint}
        panZoomLabels={panZoomLabels}
        customScrollbar
      />

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
