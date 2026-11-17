import { Snackbar, Alert, AlertTitle, Box } from '@mui/material';

/**
 * 操作が失敗したことを知らせる。閉じるまで出したままにする（読まないうちに消えないように）。
 * error は { title, detail } か null。detail は Go から返ったエラーの文（errorMessage）
 */
function ErrorSnackbar({ error, onClose }) {
  return (
    <Snackbar
      open={!!error}
      onClose={(_e, reason) => { if (reason !== 'clickaway') onClose(); }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="error"
        variant="filled"
        onClose={onClose}
        sx={{ maxWidth: '80vw', fontSize: '13px', alignItems: 'flex-start' }}
      >
        <AlertTitle sx={{ fontSize: '13px', fontWeight: 600, mb: error?.detail ? 0.5 : 0 }}>
          {error?.title}
        </AlertTitle>
        {error?.detail && (
          <Box
            component="pre"
            sx={{
              m: 0,
              maxHeight: '30vh',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: 'inherit',
              fontSize: '12px',
              userSelect: 'text',
            }}
          >
            {error.detail}
          </Box>
        )}
      </Alert>
    </Snackbar>
  );
}

export default ErrorSnackbar;
