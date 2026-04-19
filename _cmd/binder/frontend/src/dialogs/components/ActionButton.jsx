import { Tooltip, IconButton } from '@mui/material';

const variantColors = {
  confirm: 'var(--accent-blue)',
  delete:  'var(--accent-red)',
  cancel:  'inherit',
};

/**
 * ダイアログ用アイコンボタン
 * variant: 'confirm' (青) | 'delete' (赤) | 'cancel' (デフォルト)
 */
export function ActionButton({ label, icon, onClick, disabled, variant = 'cancel', size = 'medium', type, sx }) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          type={type}
          onClick={onClick}
          disabled={disabled}
          size={size}
          sx={{ color: disabled ? undefined : variantColors[variant], ...sx }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}
