/**
 * 囲み（GitHub Alerts の > [!NOTE] など）を入れる。
 *
 * 書き方は GitHub Alerts プラグイン（plugins/marked/github-alerts.js）と同じ。
 * プラグインが無いと普通の引用として表示されるため、メニューはプラグインが効いているときだけ出す。
 */

// 囲みの種類（プラグインの alertTypes と同じ順・同じアイコン）
export const ALERT_TYPES = [
  { type: 'NOTE', icon: 'ℹ️' },
  { type: 'TIP', icon: '💡' },
  { type: 'IMPORTANT', icon: '❗' },
  { type: 'WARNING', icon: '⚠️' },
  { type: 'CAUTION', icon: '🛑' },
];

/**
 * GitHub Alerts プラグインが効いているかを返す。
 * ファイル名（github-alerts）か、プラグインの名前（@plugin-name: GitHub Alerts）で見分ける。
 *
 * @param {object} status - Marked.getPluginStatus() の結果
 * @returns {boolean}
 */
export function hasAlertsPlugin(status) {
  return Object.entries(status || {}).some(([name, s]) =>
    s?.applied && (name === 'github-alerts' || s.meta?.name === 'GitHub Alerts'));
}

/**
 * 選んでいる範囲（start〜end）に入れる囲みの文字列を返す。
 *
 * - 選んでいなければ「> [!TYPE]」と、本文を書き始める「> 」を入れる
 * - 選んでいれば、選んだ各行の頭に「> 」を付けて囲む
 * - 行の途中から始まるときは、改行してから入れる
 *
 * @param {string} value - 本文
 * @param {number} start - 選択の始まり
 * @param {number} end - 選択の終わり
 * @param {string} type - NOTE / TIP / IMPORTANT / WARNING / CAUTION
 * @returns {string}
 */
export function alertInsertText(value, start, end, type) {
  const prefix = start > 0 && value[start - 1] !== '\n' ? '\n' : '';
  const head = `> [!${type}]\n`;
  const selected = value.substring(start, end);
  if (!selected) return prefix + head + '> ';
  const body = selected.replace(/\n$/, '').split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n');
  return prefix + head + body + (selected.endsWith('\n') ? '\n' : '');
}
