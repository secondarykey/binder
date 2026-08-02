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

// メタ行の列定義。表示名は長さがまちまちなので広く取り、値の2列は内容の
// 最大幅（"v10.10.10" / "marked >=14 <19"）に合わせて詰める。
// 状態は列に出さず、ドットの色と行のツールチップで示す。
const COLUMNS = 'minmax(0, 1.8fr) minmax(0, 0.6fr) minmax(0, 1.1fr)';

// 未宣言のプレースホルダ。列が何かは位置で分かるため項目名は繰り返さない。
// 翻訳対象にならない記号なので言語ファイルには置かない
const UNDECLARED = '-';

const cellSx = {
  fontSize: '11px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// 値の3列は中央寄せ。列が詰まっているぶん、左寄せより縦の並びが読みやすい
const valueCellSx = { ...cellSx, textAlign: 'center' };

/**
 * 互換状態を示すドット。状態は文字列では出さないため、これと行のツールチップが
 * 唯一の手掛かりになる。3つの一覧で見た目を揃えるためここに置く。
 *
 * @param {string} status 互換状態
 */
export function StatusDot({ status }) {
  return (
    <Box
      component="span"
      sx={{
        width: '12px',
        height: '12px',
        marginRight: '8px',
        borderRadius: '50%',
        flexShrink: 0,
        backgroundColor: STATUS_COLOR[status] || 'var(--text-muted)',
      }}
    />
  );
}

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
 * プラグイン一覧の各行に出すメタ情報。表示名 / バージョン / 対応marked を列に並べる。
 * 値の2列は中央寄せ。未宣言の項目も "-" で埋める
 * （空欄だと宣言漏れなのか表示漏れなのか分からないため）。
 *
 * 互換状態はここには出さない。ドットの色と行のツールチップで足りるため、
 * 文字でも繰り返すと同じ情報が3重になる。
 *
 * @param {{name: string|null, version: string|null, marked: string|null}} meta parsePluginMeta の結果
 * @param {string} fileName ファイル名。@plugin-name が無い場合の表示名として使う
 */
export function PluginMetaLine({ meta, fileName }) {
  // @plugin-name が無ければ表示名はファイル名（従来からの名前の由来）
  const name = meta.name || fileName;
  const version = meta.version ? `v${meta.version}` : UNDECLARED;
  const range = meta.marked ? `marked ${meta.marked}` : UNDECLARED;

  return (
    <Box
      component="span"
      sx={{ display: 'grid', gridTemplateColumns: COLUMNS, gap: 1, alignItems: 'baseline' }}
    >
      <Box component="span" title={name} sx={{ ...cellSx, color: 'var(--text-muted)' }}>{name}</Box>
      <Box component="span" title={version} sx={{ ...valueCellSx, color: 'var(--text-muted)' }}>{version}</Box>
      <Box component="span" title={range} sx={{ ...valueCellSx, color: 'var(--text-muted)' }}>{range}</Box>
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
