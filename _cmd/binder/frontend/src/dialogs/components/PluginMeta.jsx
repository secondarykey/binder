/**
 * プラグイン設定画面（バインダー: PluginSetting / アプリ: AppPluginSetting）で共有する
 * メタデータ表示部品。
 *
 * プラグインの宣言（@plugin-name / @plugin-version / @marked）と、現在動作している
 * marked のバージョンを一覧上に出す。これらは従来 title 属性のツールチップにしか
 * 出ておらず、「どのプラグインがどの marked 向けなのか」を一覧で比較できなかった。
 *
 * メタ行は 4 等幅（各25%）の列に揃える。プラグイン間で同じ項目が縦に並ぶため、
 * 一覧を縦に眺めるだけでバージョンや対応レンジを比較できる。
 *
 * メタデータの解析自体は @shared/editor/pluginMeta に一元化しており、ここは表示だけを持つ。
 */

import { Box, Typography } from "@mui/material";

// 状態 → 表示色（テーマ変数）
export const STATUS_COLOR = {
  compatible: 'var(--accent-green)',
  incompatible: 'var(--accent-red)',
  loadError: 'var(--accent-red)',
  runtimeError: 'var(--accent-red)',
  notApplied: 'var(--accent-red)',
  unverified: 'var(--accent-orange, #d18616)',
  unknown: 'var(--text-muted)',
  undeclared: 'var(--text-muted)',
};

// 状態 → 列に出す短いラベル。
// 正常系も含めて全状態を持つ（列が空になると「表示漏れ」と区別が付かないため）。
export const STATUS_LABEL = {
  compatible: "plugin.compat.compatibleShort",
  incompatible: "plugin.compat.incompatibleShort",
  loadError: "plugin.compat.loadErrorShort",
  runtimeError: "plugin.compat.runtimeErrorShort",
  notApplied: "plugin.compat.notAppliedShort",
  unverified: "plugin.compat.unverifiedShort",
  unknown: "plugin.compat.unknownShort",
  undeclared: "plugin.compat.undeclaredShort",
};

// メタ行の列定義（4等幅）。ヘッダと本体で同じ値を使う
const COLUMNS = 'repeat(4, minmax(0, 1fr))';

const cellSx = {
  fontSize: '11px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/**
 * 現在の marked のバージョンを表示用の文字列にする。
 * パッチまで判明していない場合（CDN の部分指定など）はメジャーのみを "17.x" で示す。
 * @param {{version: string|null, major: number|null}|null} markedInfo
 * @returns {string|null} 判定不能なら null
 */
export function formatMarkedVersion(markedInfo) {
  if (!markedInfo) return null;
  if (markedInfo.version) return markedInfo.version;
  if (markedInfo.major != null) return `${markedInfo.major}.x`;
  return null;
}

/**
 * プラグイン一覧の各行に出すメタ情報。表示名 / バージョン / 対応marked / 状態を
 * 4 等幅の列に並べる。未宣言の項目も「未宣言」と明示する
 * （空欄だと宣言漏れなのか表示漏れなのか分からないため）。
 *
 * @param {{name: string|null, version: string|null, marked: string|null}} meta parsePluginMeta の結果
 * @param {string} fileName ファイル名。@plugin-name が無い場合の表示名として使う
 * @param {string} status 互換状態
 * @param {Function} t 翻訳関数
 */
export function PluginMetaLine({ meta, fileName, status, t }) {
  // @plugin-name が無ければ表示名はファイル名（従来からの名前の由来）
  const name = meta.name || fileName;
  const version = meta.version ? `v${meta.version}` : t("plugin.meta.versionUndeclared");
  const range = meta.marked ? `marked ${meta.marked}` : t("plugin.meta.rangeUndeclared");
  const label = STATUS_LABEL[status] ? t(STATUS_LABEL[status]) : status;

  return (
    <Box
      component="span"
      sx={{ display: 'grid', gridTemplateColumns: COLUMNS, gap: 1, alignItems: 'baseline' }}
    >
      <Box component="span" title={name} sx={{ ...cellSx, color: 'var(--text-muted)' }}>{name}</Box>
      <Box component="span" title={version} sx={{ ...cellSx, color: 'var(--text-muted)' }}>{version}</Box>
      <Box component="span" title={range} sx={{ ...cellSx, color: 'var(--text-muted)' }}>{range}</Box>
      <Box component="span" title={label} sx={{ ...cellSx, color: STATUS_COLOR[status] || 'var(--text-muted)' }}>{label}</Box>
    </Box>
  );
}

/**
 * 現在動作している marked のバージョンと取得元（内蔵 / CDN）。
 * プラグインの対応レンジは「今の marked が何か」と並べて初めて意味を持つため、
 * 一覧の直前に一度だけ出す。
 *
 * @param {{version: string|null, major: number|null, source: string}|null} markedInfo
 * @param {Function} t 翻訳関数
 */
export function MarkedVersionLine({ markedInfo, t }) {
  const version = formatMarkedVersion(markedInfo);
  const source = markedInfo && markedInfo.source === 'cdn'
    ? t("plugin.meta.sourceCdn")
    : t("plugin.meta.sourceVendor");

  return (
    <Typography
      variant="body2"
      sx={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'left' }}
    >
      {version
        ? t("plugin.meta.currentMarked", { version, source })
        : t("plugin.meta.currentMarkedUnknown")}
    </Typography>
  );
}
