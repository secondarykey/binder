import { Box, Button, Typography } from "@mui/material";
import { useTranslation } from 'react-i18next';
import "../../language";

/**
 * publish_date / republish_date の表示・リセット・クリア用フィールドコンポーネント
 * @param {{
 *   label: string,
 *   value: Date|null,
 *   onReset: () => void,
 *   onClear: () => void,
 * }} props
 */
function PublishDateField({ label, value, onReset, onClear }) {
  const { t } = useTranslation();

  const formatted = (() => {
    if (!value) return "—";
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "—";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
      <Typography variant="body2" sx={{ color: "var(--text-secondary)", minWidth: "90px", flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ flex: 1, fontFamily: "monospace", color: value ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {formatted}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={onReset}
        sx={{ minWidth: "auto", px: 1.5, fontSize: "0.7rem", borderColor: "var(--accent-blue)", color: "var(--accent-blue)" }}
      >
        {t("meta.resetToday")}
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={onClear}
        disabled={!value}
        sx={{ minWidth: "auto", px: 1.5, fontSize: "0.7rem" }}
      >
        {t("meta.clearDate")}
      </Button>
    </Box>
  );
}

export default PublishDateField;
