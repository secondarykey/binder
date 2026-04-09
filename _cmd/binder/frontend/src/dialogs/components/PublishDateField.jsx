import { Box, Typography } from "@mui/material";

/**
 * 公開日時の読み取り専用表示行コンポーネント
 * @param {{ label: string, value: Date|null }} props
 */
function PublishDateField({ label, value }) {
  const formatted = (() => {
    if (!value) return "—";
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "—";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.25 }}>
      <Typography variant="body2" sx={{ color: "var(--text-secondary)", minWidth: "90px", flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: "monospace", color: value ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {formatted}
      </Typography>
    </Box>
  );
}

export default PublishDateField;
