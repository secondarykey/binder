import { cloneElement } from 'react';
import { Tooltip, IconButton } from '@mui/material';

const variantColors = {
  confirm: 'var(--accent-blue)',
  delete:  'var(--accent-red)',
  cancel:  undefined,
};

/**
 * ダイアログ用アイコンボタン
 * variant: 'confirm' (青) | 'delete' (赤) | 'cancel' (デフォルト)
 * アイコン要素に直接 style.color を注入して確実に色を反映する
 */
export function ActionButton({ label, icon, onClick, disabled, variant = 'cancel', size = 'medium', type, sx }) {
  const color = disabled ? undefined : variantColors[variant];
  const coloredIcon = color
    ? cloneElement(icon, { style: { ...icon.props?.style, color } })
    : icon;

  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          type={type}
          onClick={onClick}
          disabled={disabled}
          size={size}
          sx={sx}
        >
          {coloredIcon}
        </IconButton>
      </span>
    </Tooltip>
  );
}
