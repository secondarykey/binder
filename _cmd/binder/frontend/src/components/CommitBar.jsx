import { useRef, useEffect, useCallback } from 'react';
import CommitIcon from '@mui/icons-material/Commit';
import { InputAdornment, TextField } from '@mui/material';

/**
 * コミットコメント入力バー。
 * parseStatusBar コンテナ + フル幅 TextField + CommitIcon で構成。
 * Enter で記録実行、Shift+Enter で改行（複数行に拡張）。
 * Note/Diagram では CSS により absolute 配置（bottom: 0）される。
 * 高さが変わると親 editorWrapper 内の .editorArea の bottom を動的に更新する。
 *
 * @param {{ comment: string, onCommentChange: (v:string)=>void, updated: boolean, onCommit: ()=>void }} props
 */
function CommitBar({ comment, onCommentChange, updated, onCommit }) {
  const barRef = useRef(null);

  const syncEditorBottom = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    const wrapper = bar.closest('#editorWrapper');
    if (!wrapper) return;
    const area = wrapper.querySelector('.editorArea');
    if (!area) return;
    area.style.bottom = bar.offsetHeight + 'px';
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const ro = new ResizeObserver(syncEditorBottom);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [syncEditorBottom]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onCommit();
    }
  };

  return (
    <div id="parseStatusBar" ref={barRef}>
      <div className="parseStatusLeft" style={{ flex: 1, minWidth: 0 }}>
        <TextField
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          size="small"
          variant="outlined"
          multiline
          minRows={1}
          maxRows={6}
          style={{ width: '100%' }}
          inputProps={{ style: { fontSize: '14px' } }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end" className="linkBtn">
                <CommitIcon
                  fontSize="small"
                  style={{ color: updated ? 'var(--accent-orange)' : 'var(--text-primary)', cursor: 'pointer' }}
                  onClick={onCommit}
                />
              </InputAdornment>
            ),
          }}
        />
      </div>
    </div>
  );
}

export default CommitBar;
