import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { watchExternalEditor } from '../components/editor/external-editor';

// run() の解決を外から操作できるようにする
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function setup({ elapsed }) {
  const proc = deferred();
  let file = 'initial';
  let clock = 0;
  const handlers = {
    onText: vi.fn(),
    onDetach: vi.fn(),
    onFinish: vi.fn(),
    onError: vi.fn(),
  };
  const ctl = watchExternalEditor({
    run: () => proc.promise,
    read: () => Promise.resolve(file),
    initialText: 'initial',
    intervalMs: 1000,
    quickExitMs: 5000,
    now: () => clock,
    ...handlers,
  });
  return {
    ctl, handlers,
    save: (v) => { file = v; },
    exit: () => { clock = elapsed; proc.resolve(); },
    fail: (err) => { clock = elapsed; proc.reject(err); },
  };
}

describe('watchExternalEditor', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('finishes when the editor process ends after a while', async () => {
    const s = setup({ elapsed: 60000 });

    s.save('edited');
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.handlers.onText).toHaveBeenCalledWith('edited');

    s.exit();
    await vi.advanceTimersByTimeAsync(0);
    expect(s.handlers.onDetach).not.toHaveBeenCalled();
    expect(s.handlers.onFinish).toHaveBeenCalledTimes(1);
  });

  it('keeps reading after a quick exit until finish is called', async () => {
    const s = setup({ elapsed: 500 });

    s.exit();
    await vi.advanceTimersByTimeAsync(0);
    expect(s.handlers.onDetach).toHaveBeenCalledTimes(1);
    expect(s.handlers.onFinish).not.toHaveBeenCalled();

    // プロセスが終わったあとの保存も読み込む
    s.save('saved later');
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.handlers.onText).toHaveBeenLastCalledWith('saved later');

    s.ctl.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(s.handlers.onFinish).toHaveBeenCalledTimes(1);

    // 終えたあとは読み込まない
    s.handlers.onText.mockClear();
    s.save('after finish');
    await vi.advanceTimersByTimeAsync(3000);
    expect(s.handlers.onText).not.toHaveBeenCalled();
  });

  it('finishes once even if finish is called again', async () => {
    const s = setup({ elapsed: 500 });
    s.exit();
    await vi.advanceTimersByTimeAsync(0);

    s.ctl.finish();
    s.ctl.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(s.handlers.onFinish).toHaveBeenCalledTimes(1);
  });

  it('reports a launch error and unlocks', async () => {
    const s = setup({ elapsed: 100 });
    const err = new Error('editor program is not set');

    s.fail(err);
    await vi.advanceTimersByTimeAsync(0);
    expect(s.handlers.onError).toHaveBeenCalledWith(err);
    expect(s.handlers.onDetach).not.toHaveBeenCalled();
    expect(s.handlers.onFinish).toHaveBeenCalledTimes(1);
  });

  it('stops reading when stopped', async () => {
    const s = setup({ elapsed: 60000 });

    s.ctl.stop();
    s.save('edited');
    await vi.advanceTimersByTimeAsync(3000);
    s.exit();
    await vi.advanceTimersByTimeAsync(0);
    expect(s.handlers.onText).not.toHaveBeenCalled();
    expect(s.handlers.onFinish).not.toHaveBeenCalled();
  });
});
