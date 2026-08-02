/**
 * プラグイン設定画面（バインダー: PluginSetting / アプリ: AppPluginSetting）で共有する
 * メタデータ表示部品。
 *
 * プラグインの宣言（@plugin-name / @plugin-version / @marked）と、現在動作している
 * marked のバージョンを一覧上に出す。これらは従来 title 属性のツールチップにしか
 * 出ておらず、「どのプラグインがどの marked 向けなのか」を一覧で比較できなかった。
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

// セカンダリラベルを出す（＝一覧を見ただけで異常と分かるべき）状態
export const SECONDARY_LABEL = {
  incompatible: "plugin.compat.incompatibleShort",
  loadError: "plugin.compat.loadErrorShort",
  runtimeError: "plugin.compat.runtimeErrorShort",
  notApplied: "plugin.compat.notAppliedShort",
  unverified: "plugin.compat.unverifiedShort",
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
 * プラグイン一覧の各行に出すメタ情報（表示名 / バージョン / 対応marked）。
 * 未宣言の項目も「未宣言」と明示する（空欄だと宣言漏れなのか表示漏れなのか分からないため）。
 *
 * @param {{name: string|null, version: string|null, marked: string|null}} meta parsePluginMeta の結果
 * @param {string} fileName ファイル名（＝一覧の primary）。表示名が同じなら重複表示しない
 * @param {string} [status] 互換状態。異常時のみ先頭に色付きラベルを出す
 * @param {Function} t 翻訳関数
 */
export function PluginMetaLine({ meta, fileName, status, t }) {
  const parts = [];

  if (meta.name && meta.name !== fileName) parts.push(meta.name);
  parts.push(meta.version ? `v${meta.version}` : t("plugin.meta.versionUndeclared"));
  parts.push(meta.marked ? `marked ${meta.marked}` : t("plugin.meta.rangeUndeclared"));

  const labelKey = status ? SECONDARY_LABEL[status] : null;

  return (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
      {labelKey && (
        <Box component="span" sx={{ fontSize: '11px', color: STATUS_COLOR[status] }}>
          {t(labelKey)}
        </Box>
      )}
      <Box component="span" sx={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        {parts.join(' · ')}
      </Box>
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
