import { Typography } from "@mui/material";

/**
 * 公開日時の読み取り専用表示行コンポーネント（グリッドセル2つを返す）
 * 親側で display:"grid" gridTemplateColumns:"max-content 1fr" のBoxで囲むこと
 * @param {{ label: string, value: Date|null }} props
 */
function PublishDateField({ label, value }) {
  const formatted = (() => {
    if (!value) return "—";
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "—";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  })();

  return (
    <>
      <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: "monospace", color: value ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {formatted}
      </Typography>
    </>
  );
}

export default PublishDateField;
