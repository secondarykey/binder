// ---- マージコンフリクトマーカー（diff3）の検出・表示 ----
// マーカーは fs/diff3.go が出力する構造的プレフィックスで判定する（ラベル文字列に依存しない）。

export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * ノート本文に未解決のコンフリクトマーカーが含まれるか。
 * ours(<<<<<<<) → mid(=======) → theirs(>>>>>>>) の3点が「この順」で存在する
 * 構造のみを検出する。単独行の誤検出（git を説明する文書など）を避けるため、
 * 3マーカーが揃った構造に限定する。
 */
export function hasConflictMarkers(text) {
  if (!text) return false;
  return /^<<<<<<< .*$[\s\S]*^=======$[\s\S]*^>>>>>>> .*$/m.test(text);
}

/**
 * コンフリクトマーカー入りの本文を、marked を通さずに色分けした完結HTMLへ変換する。
 * ours ブロック=緑、theirs ブロック=赤、マーカー行=強調。HTMLFrame の srcdoc に渡す。
 */
export function buildConflictHTML(text, bannerText) {
  const lines = (text || '').split('\n');
  let zone = 'normal'; // normal | ours | theirs
  const rows = lines.map((line) => {
    const esc = escapeHtml(line) || '&nbsp;';
    if (/^<<<<<<< /.test(line)) { zone = 'ours'; return `<div class="m ours-m">${esc}</div>`; }
    if (zone !== 'normal' && /^=======\s*$/.test(line)) { zone = 'theirs'; return `<div class="m mid-m">${esc}</div>`; }
    if (/^>>>>>>> /.test(line)) { zone = 'normal'; return `<div class="m theirs-m">${esc}</div>`; }
    const cls = zone === 'ours' ? 'ours' : zone === 'theirs' ? 'theirs' : '';
    return `<div class="${cls}">${esc}</div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin:0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:13px; line-height:1.5; color:#1a1a1a; background:#fff; }
    .banner { padding:8px 12px; background:#fff3cd; color:#664d03; border-bottom:1px solid #ffe69c; font-family: system-ui, sans-serif; }
    .body { padding:8px 12px; }
    .body > div { white-space:pre-wrap; word-break:break-word; }
    .ours { background: rgba(76,175,80,0.14); }
    .theirs { background: rgba(244,67,54,0.14); }
    .m { font-weight:bold; }
    .ours-m { background: rgba(76,175,80,0.30); color:#1b5e20; }
    .mid-m { background: rgba(0,0,0,0.08); color:#555; }
    .theirs-m { background: rgba(244,67,54,0.30); color:#b71c1c; }
    @media (prefers-color-scheme: dark) {
      body { color:#e0e0e0; background:#1e1e1e; }
      .banner { background:#3a3000; color:#ffe69c; border-bottom-color:#5a4b00; }
      .mid-m { background: rgba(255,255,255,0.12); color:#bbb; }
      .ours-m { color:#a5d6a7; } .theirs-m { color:#ef9a9a; }
    }
  </style></head><body>
    <div class="banner">&#9888; ${escapeHtml(bannerText || '')}</div>
    <div class="body">${rows}</div>
  </body></html>`;
}
