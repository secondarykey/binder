/**
 * バインダーを開いたときに整合性を修復した内容（TakeDoctorReport の結果）を知らせるメッセージを作る。
 *
 * 外部のツール（binder-organize スキル等）でバインダーを編集した後に、書き損じを開いた時点で
 * 直したことをユーザに見えるようにする。修復はシステム署名で記録されるので、
 * 履歴からその記録と前の状態を確かめられる。
 *
 * 本文が失われたもの（recreated）があれば warning、無ければ info。
 * 1 件ずつの内容は詳細（スナックバーのダブルクリックで開くダイアログ）に並べる。
 *
 * @param {{items: {id: string, typ: string, name: string, kind: string}[]}|null} report
 * @param {(key: string, opts?: object) => string} t
 * @param {() => void} openHistory 「履歴」を押したときに履歴を開く
 * @returns {object|null} Event.showMessage に渡すメッセージ。知らせることが無ければ null
 */
export function doctorReportMessage(report, t, openHistory) {
  const items = report?.items ?? [];
  if (items.length === 0) {
    return null;
  }
  const lost = items.some((i) => i.kind === 'recreated');
  const body = t(lost ? 'doctor.repairedLost' : 'doctor.repaired', { count: items.length });
  const detail = items
    .map((i) => `「${i.name || i.id}」${t('doctor.' + i.kind)}`)
    .join('\n');
  return {
    type: lost ? 'warning' : 'info',
    body,
    detail,
    debug: '',
    action: { label: t('common.history'), onClick: openHistory },
  };
}
