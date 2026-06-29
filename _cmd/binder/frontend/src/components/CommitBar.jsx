import CommitIcon from '@mui/icons-material/Commit';
import { InputAdornment, TextField } from '@mui/material';

/**
 * コミットコメント入力バー。
 * parseStatusBar コンテナ + フル幅 TextField + CommitIcon で構成。
 * Enter で記録実行、Shift+Enter で改行（複数行に拡張）。
 * Note/Diagram では CSS により absolute 配置（bottom: 0）される。
 *
 * @param {{ comment: string, onCommentChange: (v:string)=>void, updated: boolean, onCommit: ()=>void }} props
 */
function CommitBar({ comment, onCommentChange, updated, onCommit }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onCommit();
    }
  };

  return (
    <div id="parseStatusBar">
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
            sx: { padding: '4px 14px' },
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
