import CommitIcon from '@mui/icons-material/Commit';
import { InputAdornment, TextField } from '@mui/material';

/**
 * コミットコメント入力バー。
 * parseStatusBar コンテナ + フル幅 TextField + CommitIcon で構成。
 * Note/Diagram では CSS により absolute 配置（bottom: 0）される。
 *
 * @param {{ comment: string, onCommentChange: (v:string)=>void, updated: boolean, onCommit: ()=>void }} props
 */
function CommitBar({ comment, onCommentChange, updated, onCommit }) {
  return (
    <div id="parseStatusBar">
      <div className="parseStatusLeft" style={{ flex: 1, minWidth: 0 }}>
        <TextField
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          size="small"
          variant="outlined"
          style={{ width: '100%' }}
          inputProps={{ style: { fontSize: '12px', paddingTop: '4px', paddingBottom: '4px' } }}
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
