import { describe, it, expect, vi } from 'vitest';
import { doctorReportMessage } from '../app/doctorReport';

const t = (key, opts) => (opts ? `${key}:${opts.count}` : key);

describe('doctorReportMessage', () => {
  it('returns null when nothing was repaired', () => {
    expect(doctorReportMessage(null, t, () => {})).toBeNull();
    expect(doctorReportMessage({ items: [] }, t, () => {})).toBeNull();
    expect(doctorReportMessage({ items: null }, t, () => {})).toBeNull();
  });

  it('is info when no content was lost', () => {
    const msg = doctorReportMessage({
      items: [
        { id: 'a', typ: 'note', name: 'Alpha', kind: 'orphan' },
        { id: 'b', typ: 'note', name: '', kind: 'reparented' },
      ],
    }, t, () => {});
    expect(msg.type).toBe('info');
    expect(msg.body).toBe('doctor.repaired:2');
    // 名前が無ければ id を出す
    expect(msg.detail).toBe('「Alpha」doctor.orphan\n「b」doctor.reparented');
  });

  it('is a warning when a file was recreated (content lost)', () => {
    const msg = doctorReportMessage({
      items: [{ id: 'a', typ: 'note', name: 'Alpha', kind: 'recreated' }],
    }, t, () => {});
    expect(msg.type).toBe('warning');
    expect(msg.body).toBe('doctor.repairedLost:1');
  });

  it('opens the history from the action', () => {
    const openHistory = vi.fn();
    const msg = doctorReportMessage({
      items: [{ id: 'a', typ: 'note', name: 'Alpha', kind: 'row' }],
    }, t, openHistory);
    expect(msg.action.label).toBe('common.history');
    msg.action.onClick();
    expect(openHistory).toHaveBeenCalledTimes(1);
  });
});
