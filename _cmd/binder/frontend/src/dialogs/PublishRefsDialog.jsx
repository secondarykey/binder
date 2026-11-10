import { useEffect, useRef, useState } from 'react';
import {
  Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  List, ListItemButton, ListItemIcon, ListItemText, ListSubheader,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PublishIcon from '@mui/icons-material/Publish';

import "../language";
import { useTranslation } from 'react-i18next';

import { ActionButton } from './components/ActionButton';

// 一覧の見出し（未公開一覧と同じ表記）
const SECTIONS = [
  ["diagram", "Diagram"],
  ["asset", "Asset"],
  ["layer", "Layer"],
];

/**
 * ノートを公開するときに、まだ公開していない参照先（図・アセット・レイヤー）を
 * 一緒に公開するかを選ぶダイアログ。最初はすべて選んだ状態で開く。
 *
 * @param {{
 *   open: boolean,
 *   refs: { id: string, type: string, name: string }[],
 *   onCancel: () => void,
 *   onConfirm: (selected: object[]) => void,
 * }} props
 */
export function PublishRefsDialog({ open, refs, onCancel, onConfirm }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(new Set());

  useEffect(() => {
    if (open) setChecked(new Set(refs.map((r) => r.id)));
  }, [open, refs]);

  const toggle = (id) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChecked(next);
  };

  const handleConfirm = () => onConfirm(refs.filter((r) => checked.has(r.id)));

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      PaperProps={{ style: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", minWidth: 420 } }}
    >
      <DialogTitle>{t("publishRefs.title")}</DialogTitle>
      <DialogContent>
        <DialogContentText style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
          {t("publishRefs.message")}
        </DialogContentText>
        <List dense disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
          {SECTIONS.map(([type, label]) => {
            const list = refs.filter((r) => r.type === type);
            if (list.length === 0) return null;
            return (
              <li key={type}>
                <ul style={{ padding: 0 }}>
                  <ListSubheader disableSticky
                    sx={{
                      lineHeight: '28px', px: 0.5, fontSize: '0.7rem', fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6,
                      backgroundColor: 'transparent', color: 'inherit',
                    }}>
                    {label}
                  </ListSubheader>
                  {list.map((r) => (
                    <ListItemButton key={r.id} onClick={() => toggle(r.id)}
                      sx={{ pl: 1, py: 0.25, borderRadius: '2px', '&:hover': { backgroundColor: 'var(--selected-bg)' } }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Checkbox size="small" checked={checked.has(r.id)} tabIndex={-1} disableRipple sx={{ p: 0.5 }}
                          inputProps={{ 'aria-label': r.name }} />
                      </ListItemIcon>
                      <ListItemText primary={r.name} primaryTypographyProps={{ noWrap: true, fontSize: '0.875rem' }} />
                    </ListItemButton>
                  ))}
                </ul>
              </li>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={onCancel} />
        <ActionButton variant="confirm" label={t("publishRefs.publish")} icon={<PublishIcon />} onClick={handleConfirm} />
      </DialogActions>
    </Dialog>
  );
}

/**
 * PublishRefsDialog を Promise で使うためのフック。
 * ask(refs) は、選んだ参照先の配列（何も選ばなければ空）か、キャンセルなら null で解決する。
 * @returns {[JSX.Element, (refs: object[]) => Promise<object[]|null>]}
 */
export function usePublishRefsDialog() {
  const [state, setState] = useState({ open: false, refs: [] });
  const resolver = useRef(null);

  const finish = (value) => {
    const resolve = resolver.current;
    resolver.current = null;
    setState((s) => ({ ...s, open: false }));
    if (resolve) resolve(value);
  };

  const ask = (refs) => new Promise((resolve) => {
    resolver.current = resolve;
    setState({ open: true, refs });
  });

  const dialog = (
    <PublishRefsDialog
      open={state.open}
      refs={state.refs}
      onCancel={() => finish(null)}
      onConfirm={(selected) => finish(selected)}
    />
  );
  return [dialog, ask];
}

export default PublishRefsDialog;
