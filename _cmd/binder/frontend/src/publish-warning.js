// 公開ページにプレビューで止めていたスクリプトがあるときの警告の頭（Go 側の binder.ScriptsWarning）
const SCRIPTS_WARNING = 'scripts(';

/**
 * 公開したあとに出す警告メッセージを返す。
 *
 * スクリプトの警告は件数だけでは中身が分からず見落とすため、ほかの警告より優先して
 * 専用の文で知らせる。信頼していないバインダーでは、プレビューでスクリプトを止めているので、
 * どう動くかを一度も見ないまま公開したことになる。
 */
export function publishWarningMessage(t, warnings) {
  const scripts = warnings.filter((w) => String(w).startsWith(SCRIPTS_WARNING)).length;
  if (scripts > 0) {
    return t('preview.publishScriptsWarn', { count: scripts });
  }
  return t('preview.publishWarn', { count: warnings.length });
}
